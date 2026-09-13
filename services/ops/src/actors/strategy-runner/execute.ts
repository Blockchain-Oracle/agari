import { isOk } from "@masayume/core/schemas";
import { dailyHeadroomBase, type VaultGrant } from "@masayume/core/vault";
import type { Decision, StrategyFill, StrategySubscription } from "@masayume/core/strategies";
import { toMarketId, type EventMarket, type MarketId } from "@masayume/core/types";
import { msToSec } from "@masayume/core/units";
import { marketsProvider, type SubmitterSession } from "@masayume/markets";
import { beginStrategyAttempt, finishStrategyAttempt, getStrategyAttempt, recordAttemptFill } from "@masayume/db";

export type ExecutionResult =
  | { status: "filled"; fill: StrategyFill }
  | { status: "skipped"; reason: string }
  | { status: "refused"; reason: string }
  | { status: "unknown"; reason: string }
  | { status: "dry-run"; stakeBase: bigint };

/**
 * The grant, head-fresh: an owner holds one live STRATEGY grant at a time, so the vault snapshot's
 * strategy slot is the subscription's grant exactly when the ids agree — a stale or replaced grant
 * reads as "not live", never as a cached copy the contract would refuse.
 */
async function readGrant(owner: StrategySubscription["subscriber"], grantId: bigint): Promise<VaultGrant | null> {
  const snapshot = await marketsProvider.getVaultSnapshot(owner);
  if (!isOk(snapshot) || snapshot.stale || !snapshot.value) return null;
  const grant = snapshot.value.grants.strategy;
  return grant && grant.grantId === grantId ? grant : null;
}

/**
 * One subscriber, one Window, one decision → at most one IOC through the subscriber's grant.
 * The stake is the smallest of the per-trade cap, today's headroom and the budget; a subscriber
 * already holding this Window is left alone (one entry per Window, the reference's rule).
 */
export async function executeForSubscriber(input: {
  session: SubmitterSession;
  sub: StrategySubscription;
  market: EventMarket;
  decision: Decision;
  nowMs: number;
  dryRun: boolean;
}): Promise<ExecutionResult> {
  const { session, sub, market, decision, nowMs, dryRun } = input;
  const side = decision.side;
  if (!side) return { status: "skipped", reason: "no side" };
  const key = { strategyId: sub.strategyId.toString(), marketId: market.marketId, owner: sub.subscriber };
  if (!dryRun) {
    const previous = await getStrategyAttempt(key);
    if (previous) return { status: previous.state === "unknown" || previous.state === "attempting" ? "unknown" : "skipped", reason: `this Window already has an ${previous.state} attempt; not resending` };
  }
  const grant = await readGrant(sub.subscriber, sub.grantId);
  if (!grant || grant.revoked || msToSec(nowMs) > grant.expiresAtSec) return { status: "skipped", reason: "grant not live" };

  const onchain = await marketsProvider.getOnchain(market.marketId);
  if (!isOk(onchain) || onchain.stale) return { status: "skipped", reason: `chain read unavailable: ${isOk(onchain) ? "stale state" : onchain.error.technical}; holding` };
  const held = await marketsProvider.getVaultHoldings(grant.owner, onchain.value);
  if (!isOk(held) || held.stale) return { status: "skipped", reason: "holdings unreadable; holding" };
  if (held.value.upRaw + held.value.downRaw > 0n) return { status: "skipped", reason: "already in this Window" };

  const headroom = dailyHeadroomBase(grant, msToSec(nowMs));
  const stakeBase = [grant.caps.maxStakePerTradeBase, headroom, grant.budgetBase].reduce((min, v) => (v < min ? v : min));
  if (stakeBase <= 0n) return { status: "skipped", reason: "no headroom today" };
  if (dryRun) return { status: "dry-run", stakeBase };

  const target = { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };
  const quote = await marketsProvider.freshQuoteStake(target, side, stakeBase);
  if (!isOk(quote) || quote.stale || !quote.value) return { status: "skipped", reason: "nothing freshly quoted at this size; holding" };
  const [fromBlock, nonce] = await Promise.all([session.contracts.publicClient.getBlockNumber(), session.contracts.publicClient.getTransactionCount({ address: session.address, blockTag: "pending" })]);
  const acquired = await beginStrategyAttempt({ ...key, runner: session.address, grantId: sub.grantId.toString(), side, stakeBase: stakeBase.toString(), fromBlock: fromBlock.toString(), nonce });
  if (!acquired) return { status: "skipped", reason: "another attempt already reserved this Window; not resending" };
  try {
    const outcome = await session.submitter.submitOrder({
      market,
      side,
      stakeBase,
      displayedQuote: quote.value,
      wallet: session.address,
      route: { kind: "vault-grant", grantId: sub.grantId },
    });
    if (outcome.status === "confirmed") {
      const fill: StrategyFill = {
        txHash: outcome.booked.txHash,
        strategyId: sub.strategyId,
        grantId: sub.grantId,
        owner: grant.owner,
        marketId: toMarketId(market.marketId) as MarketId,
        side,
        cashDeltaBase: outcome.booked.costBase,
        tokenDeltaRaw: outcome.booked.contractsRaw,
        atSec: msToSec(nowMs),
        dryRun: false,
      };
      await recordAttemptFill({ txHash: fill.txHash, strategyId: fill.strategyId.toString(), grantId: fill.grantId.toString(), owner: fill.owner, marketId: fill.marketId, side: fill.side, cashDelta: fill.cashDeltaBase.toString(), tokenDelta: fill.tokenDeltaRaw.toString(), atSec: fill.atSec, dryRun: false });
      return { status: "filled", fill };
    }
    const reason = outcome.status === "nothingFilled" ? "the book moved; nothing filled" : outcome.status === "requote" ? "quote moved past the cap" : outcome.diagnosis.technical;
    const state = outcome.status === "nothingFilled" ? "nothing-filled" : outcome.status === "requote" ? "refused" : outcome.status;
    await finishStrategyAttempt(key, state, "txHash" in outcome ? outcome.txHash ?? null : null, reason);
    return { status: state === "unknown" ? "unknown" : state === "nothing-filled" ? "skipped" : "refused", reason };
  } catch (error) {
    const reason = `confirmation unknown: ${error instanceof Error ? error.message : String(error)}; not resending`;
    await finishStrategyAttempt(key, "unknown", null, reason).catch(() => undefined);
    return { status: "unknown", reason };
  }
}
