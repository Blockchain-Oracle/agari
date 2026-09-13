import { isOk } from "@masayume/core/schemas";
import { toMarketId, type Address, type Hex } from "@masayume/core/types";
import { beginStrategyAttempt, finishStrategyAttempt, getStrategyAttempt, listStrategyFills, listStrategyOwners, listUnresolvedStrategyAttempts, recordAttemptFill, type StrategyFillRecord } from "@masayume/db";
import { marketsProvider, type SubmitterSession } from "@masayume/markets";
import { listStrategySubscribers } from "@masayume/markets/strategies";
import { getVaultGrant, listVaultTallies, recoverVaultExecution } from "@masayume/markets/vault";

/** Unknown sends are recovered from receipts/events. They are never submitted again. */
export async function reconcileRunnerAttempts(session: SubmitterSession, log: (why: string) => void): Promise<Set<string>> {
  const unresolved = new Set<string>();
  for (const attempt of await listUnresolvedStrategyAttempts(session.address)) {
    try {
      if (attempt.kind === "settle") {
        const chain = await marketsProvider.getOnchain(toMarketId(attempt.marketId));
        if (!isOk(chain) || chain.stale) throw new Error("settlement state unreadable");
        const held = await marketsProvider.getVaultHoldings(attempt.owner as Address, chain.value);
        if (isOk(held) && !held.stale && held.value.upRaw + held.value.downRaw === 0n) {
          await finishStrategyAttempt(attempt, "settled", attempt.txHash, "positions settled on-chain; proceeds belong to owner");
          continue;
        }
        if (attempt.txHash) {
          const receipt = await session.contracts.publicClient.getTransactionReceipt({ hash: attempt.txHash as Hex }).catch(() => null);
          if (receipt?.status === "reverted") {
            await finishStrategyAttempt(attempt, "reverted", attempt.txHash, "settlement reverted; owner can settle manually");
            continue;
          }
        }
        unresolved.add(attempt.strategyId);
        await finishStrategyAttempt(attempt, "unknown", attempt.txHash, "settlement confirmation unknown; not resending");
        continue;
      }
      const recovery = { owner: attempt.owner as Address, actor: session.address, side: attempt.side, expectedNonce: attempt.nonce, marketId: toMarketId(attempt.marketId), grantId: BigInt(attempt.grantId), fromBlock: BigInt(attempt.fromBlock) };
      const result = await recoverVaultExecution({ ...recovery, txHash: attempt.txHash as Hex | null });
      if (result.status === "confirmed") {
        if (result.tokenDelta > 0n) await recordAttemptFill({ txHash: result.txHash, strategyId: attempt.strategyId, grantId: attempt.grantId, owner: attempt.owner, marketId: attempt.marketId, side: result.side, cashDelta: result.cashDelta.toString(), tokenDelta: result.tokenDelta.toString(), atSec: result.atSec, dryRun: false });
        else await finishStrategyAttempt(attempt, "nothing-filled", result.txHash, "confirmed IOC filled nothing");
        log(`#${attempt.strategyId}: recovered ${result.txHash}`);
      } else if (result.status === "reverted") {
        await finishStrategyAttempt(attempt, "reverted", result.txHash, "receipt confirms revert");
      } else {
        // An expired Window prevents a later fill, but cannot prove whether an earlier send filled.
        // The bounded evidence scan may be incomplete; unknown must continue to hold this actor.
        unresolved.add(attempt.strategyId);
        await finishStrategyAttempt(attempt, "unknown", attempt.txHash, "confirmation unknown; not resending");
      }
    } catch (error) {
      unresolved.add(attempt.strategyId);
      log(`#${attempt.strategyId}: confirmation unknown: ${error instanceof Error ? error.message : String(error)}; not resending`);
    }
  }
  return unresolved;
}

/** Clean up old grants too. Proceeds always remain in the owner's available balance. */
export async function settleStrategyPositions(session: SubmitterSession, strategyId: bigint, dryRun: boolean, log: (why: string) => void): Promise<number> {
  const [subscribers, recorded] = await Promise.all([listStrategySubscribers(strategyId), listStrategyOwners(strategyId.toString())]);
  const owners = [...new Set([...subscribers, ...recorded].map((owner) => owner.toLowerCase() as Address))];
  let fills: StrategyFillRecord[] | undefined;
  let settled = 0;
  for (const owner of owners) {
    const history = await listVaultTallies(owner, { complete: true });
    if (!history.complete) throw new Error("settlement history incomplete; holding new entries");
    for (const tally of history.tallies) {
      if (tally.settledAtSec > 0) continue;
      const chain = await marketsProvider.getOnchain(tally.marketId);
      if (!isOk(chain) || chain.stale) throw new Error(`settlement state unreadable for ${tally.marketId}`);
      if (!chain.value.isResolved && !chain.value.isVoided) continue;
      const holdings = await marketsProvider.getVaultHoldings(owner, chain.value);
      if (!isOk(holdings) || holdings.stale) throw new Error(`settlement holdings unreadable for ${owner}`);
      const h = holdings.value;
      const grants = [...new Set([...(h.upRaw > 0n && h.upGrantId > 0n ? [h.upGrantId] : []), ...(h.downRaw > 0n && h.downGrantId > 0n ? [h.downGrantId] : [])])];
      let ours = 0;
      for (const id of grants) {
        const grant = await getVaultGrant(id);
        if (grant.kind === "strategy" && grant.actor === session.address.toLowerCase()) ours += 1;
      }
      if (!ours) continue;
      // Owner-wide history can contain another strategy's position, including a replaced grant.
      // A settlement burns both sides, so every held side must have the same proven origin.
      const attributionUnknown = () => new Error(`settlement strategy attribution unknown for ${owner}/${tally.marketId}; holding until the original fill is available or the owner settles from Portfolio`);
      if (ours !== grants.length) throw attributionUnknown();
      fills ??= (await listStrategyFills(null, null)) ?? undefined;
      if (!fills) throw attributionUnknown();
      const origins = new Set<string>();
      for (const [side, amount, grantId] of [["up", h.upRaw, h.upGrantId], ["down", h.downRaw, h.downGrantId]] as const) {
        if (amount === 0n) continue;
        const matching = fills.filter((fill) => !fill.dryRun && fill.owner.toLowerCase() === owner && fill.marketId.toLowerCase() === tally.marketId.toLowerCase() && fill.grantId === grantId.toString() && fill.side === side && BigInt(fill.tokenDelta) > 0n);
        if (grantId === 0n || matching.length === 0) throw attributionUnknown();
        for (const fill of matching) origins.add(fill.strategyId);
      }
      if (origins.size !== 1) throw attributionUnknown();
      const originStrategyId = [...origins][0]!;
      if (dryRun) { log(`#${originStrategyId}: would settle ${tally.marketId} for ${owner}`); continue; }
      const key = { strategyId: originStrategyId, marketId: tally.marketId, owner, kind: "settle" as const };
      const previous = await getStrategyAttempt(key);
      if (previous) throw new Error(`settlement ${previous.state}: prior attempt not repeated; inspect the receipt or settle from Portfolio`);
      const [fromBlock, nonce] = await Promise.all([session.contracts.publicClient.getBlockNumber(), session.contracts.publicClient.getTransactionCount({ address: session.address, blockTag: "pending" })]);
      if (!await beginStrategyAttempt({ ...key, runner: session.address, grantId: (grants[0] ?? 0n).toString(), side: h.upRaw > 0n ? "up" : "down", stakeBase: "0", fromBlock: fromBlock.toString(), nonce })) throw new Error("settlement unknown: an existing reservation prevents resubmission");
      const result = await session.submitter.submitTx({ kind: "vault-crank-settle", owner, marketId: tally.marketId }).catch(async (error) => {
        await finishStrategyAttempt(key, "unknown", null, String(error)).catch(() => undefined);
        throw new Error(`settlement unknown: ${String(error)}; not resending`);
      });
      if (result.status !== "confirmed") {
        await finishStrategyAttempt(key, result.status === "unknown" ? "unknown" : result.status === "reverted" ? "reverted" : "refused", "txHash" in result ? result.txHash ?? null : null, result.diagnosis.technical);
        throw new Error(`settlement ${result.status}: ${result.diagnosis.technical}`);
      }
      await finishStrategyAttempt(key, "settled", result.txHash, "settlement receipt confirmed");
      const after = await marketsProvider.getVaultHoldings(owner, chain.value);
      if (!isOk(after) || after.stale || after.value.upRaw + after.value.downRaw !== 0n) throw new Error("settlement receipt landed but holdings could not be verified");
      settled += 1;
      log(`#${originStrategyId}: settled ${tally.marketId} for ${owner} — ${result.txHash}; proceeds available to the owner`);
    }
  }
  return settled;
}

/** A slow provider must never start a second cycle alongside the first. */
export function serialCycle(tick: () => Promise<void>, onError: (error: unknown) => void): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try { await tick(); } catch (error) { onError(error); } finally { running = false; }
  };
}
