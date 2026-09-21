import { isOk } from "@agari/core/schemas";
import { dailyHeadroomBase, type VaultGrant } from "@agari/core/vault";
import { sideForSubscriber, type Decision, type StrategyFill, type StrategySubscription } from "@agari/core/strategies";
import { toMarketId, type EventMarket, type MarketId } from "@agari/core/types";
import { msToSec } from "@agari/core/units";
import { marketsProvider, type SubmitterSession, readRecoveryCursor } from "@agari/markets";
import { beginStrategyAttempt, finishStrategyAttempt, getStrategyAttempt, recordAttemptFill } from "@agari/db";

export type ExecutionResult =
  | { status: "filled"; fill: StrategyFill }
  | { status: "skipped"; reason: string }
  | { status: "refused"; reason: string }
  | { status: "unknown"; reason: string }
  | { status: "dry-run"; stakeBase: bigint };

/**
 * The grant, head-fresh: an owner holds one live STRATEGY grant at a time, so the vault snapshot's
 * strategy slot is the subscription's grant exactly when the ids agree — a replaced grant reads as
 * "not live", never as a cached copy the contract would refuse.
 *
 * A read that fails or comes back stale is a third answer, not the second one. It used to collapse into
 * "grant not live", which is a sentence about the subscriber's permission, and the permission was live the
 * whole time: four grants on chain, not revoked and not expired, while the runner declined to trade for any
 * of them because the endpoint it reads through was rate-limiting. An outage holds; it does not accuse.
 */
type GrantRead = { kind: "grant"; grant: VaultGrant } | { kind: "none" } | { kind: "unreadable"; why: string };

async function readGrant(owner: StrategySubscription["subscriber"], grantId: bigint): Promise<GrantRead> {
  const snapshot = await marketsProvider.getVaultSnapshot(owner);
  // A read that failed or came back stale says nothing about the permission. Reporting it as "grant not live"
  // sent a subscriber off to re-grant a permission that was live the whole time; it is an outage, and it holds.
  if (!isOk(snapshot)) return { kind: "unreadable", why: snapshot.error.technical };
  if (snapshot.stale) return { kind: "unreadable", why: "the vault read is stale" };
  if (!snapshot.value) return { kind: "none" };
  const grant = snapshot.value.grants.strategy;
  return grant && grant.grantId === grantId ? { kind: "grant", grant } : { kind: "none" };
}

/**
 * One subscriber, one Window, one decision → at most one IOC through the subscriber's grant, on the side their
 * own consent record names.
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
  // A-1c: a fader consented to the opposite of this strategy, so the decision is turned around for them and for
  // nobody else. One decision, two sides, each backed by its own consent record on chain.
  const side = decision.side === null ? null : sideForSubscriber(decision.side, sub.fade);
  if (!side) return { status: "skipped", reason: "no side" };
  const key = { strategyId: sub.strategyId.toString(), marketId: market.marketId, owner: sub.subscriber };
  if (!dryRun) {
    const previous = await getStrategyAttempt(key);
    if (previous) return { status: previous.state === "unknown" || previous.state === "attempting" ? "unknown" : "skipped", reason: `this Window already has an ${previous.state} attempt; not resending` };
  }
  const read = await readGrant(sub.subscriber, sub.grantId);
  // Skipped, not unknown: "unknown" means a write may have gone out. Nothing was sent here — a read failed.
  if (read.kind === "unreadable") return { status: "skipped", reason: `the grant could not be read, holding: ${read.why}` };
  if (read.kind === "none") return { status: "skipped", reason: "grant not live" };
  const grant = read.grant;
  if (grant.revoked || msToSec(nowMs) > grant.expiresAtSec) return { status: "skipped", reason: grant.revoked ? "grant revoked" : "grant expired" };

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
  // The recovery cursor is the slot before the send; Solana has no account nonce, so the stored nonce is 0 (S9 reshapes the row).
  const cursor = await readRecoveryCursor();
  if (!isOk(cursor)) return { status: "skipped", reason: `recovery cursor unreadable: ${cursor.error.technical}; holding` };
  const acquired = await beginStrategyAttempt({ ...key, runner: session.address, grantId: sub.grantId.toString(), side, stakeBase: stakeBase.toString(), fromBlock: cursor.value.fromSlot.toString(), nonce: 0 });
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
    // A strategy never asks to rest (`entry: "rest"` is the ticket's pre-open call, D-088), so a resting outcome is a refusal here.
    const reason = outcome.status === "nothingFilled" ? "the book moved; nothing filled" : outcome.status === "requote" ? "quote moved past the cap" : outcome.status === "resting" ? "a resting call is not a strategy fill" : outcome.diagnosis.technical;
    const state = outcome.status === "nothingFilled" ? "nothing-filled" : outcome.status === "requote" || outcome.status === "resting" ? "refused" : outcome.status;
    await finishStrategyAttempt(key, state, "txHash" in outcome ? outcome.txHash ?? null : null, reason);
    return { status: state === "unknown" ? "unknown" : state === "nothing-filled" ? "skipped" : "refused", reason };
  } catch (error) {
    const reason = `confirmation unknown: ${error instanceof Error ? error.message : String(error)}; not resending`;
    await finishStrategyAttempt(key, "unknown", null, reason).catch(() => undefined);
    return { status: "unknown", reason };
  }
}
