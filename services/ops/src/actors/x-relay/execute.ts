import { noEntryCutoffSec } from "@agari/core/lifecycle";
import { describeRefusal, isBalanceOnlyXGrant, parseInstruction, selectXWindow, X_REFUSAL_DETAILS, type XInstruction } from "@agari/core/x";
import { xLinkByAuthor, xReceiptUpsert, type XReceiptRecord } from "@agari/db";
import { getCollateral, getVaultSnapshot, marketsProvider, readRecoveryCursor, resolveVenueId, type SubmitterSession } from "@agari/markets";
import type { Address } from "@agari/core/types";
import type { Mention } from "./transport";
import { outcomeToReceipt } from "./receipt-outcome";

export interface ExecutorContext {
  session: SubmitterSession;
  venueId: Address;
  log: (why: string) => void;
  /** Required in production: preserve wallet/target before entering the signing lane. */
  checkpoint?: (receipt: XReceiptRecord) => Promise<void>;
}

/** Every mention ends as one row: the instruction, what it resolved to, and what became of it. */
function receiptFor(mention: Mention, over: Partial<XReceiptRecord>): XReceiptRecord {
  return {
    mentionId: mention.id,
    authorId: mention.authorId,
    handle: mention.handle,
    wallet: null,
    grantId: null,
    marketId: null,
    side: null,
    stakeBase: null,
    status: "refused",
    reason: null,
    txHash: null,
    instruction: mention.text,
    atMs: mention.createdAtMs,
    ...over,
  };
}

/** The soonest Window still enterable for the asset and cadence a mention named. */
async function liveWindow(venueId: Address, instruction: XInstruction) {
  let lanes = await marketsProvider.listLiveLanes(venueId);
  // Retry the read once, never the order. A failed refresh is not evidence of an empty venue.
  if (!lanes.ok || lanes.stale) lanes = await marketsProvider.listLiveLanes(venueId);
  if (!lanes.ok || lanes.stale) return { ok: false as const, code: "market-data-unavailable" as const };
  return selectXWindow(lanes.value.lanes.flatMap(lane => lane.markets), instruction, marketsProvider.nowMs());
}

/**
 * One mention → one receipt. Authenticate the author by their live link, parse deterministically,
 * resolve the Window, check the EXECUTOR grant is live and names this executor, quote, and send
 * through the same order lane every surface uses — `route: vault-grant`, caps pre-checked by
 * `simulateCaps` and enforced again by the contract. Nothing here can pay the executor.
 */
export async function executeMention(ctx: ExecutorContext, mention: Mention): Promise<XReceiptRecord> {
  const { decimals } = getCollateral();
  const link = await xLinkByAuthor(mention.authorId);
  if (!link) return receiptFor(mention, { refusalCode: "account-not-linked", reason: "Link this X account to a wallet in the app." });
  await ctx.checkpoint?.(receiptFor(mention, { wallet: link.wallet, status: "submitted" }));

  const parsed = parseInstruction(mention.text, { decimals });
  if (!parsed.ok) return receiptFor(mention, { wallet: link.wallet, refusalCode: "instruction-invalid", parseRefusal: parsed.reason, reason: describeRefusal(parsed.reason) });
  const { instruction } = parsed;
  const base = { wallet: link.wallet, side: instruction.side, stakeBase: instruction.stakeBase.toString(), asset: instruction.asset, intervalSec: instruction.intervalSec };

  const snapshot = await getVaultSnapshot(link.wallet as Address);
  if (!snapshot.ok || snapshot.stale) return receiptFor(mention, { ...base, refusalCode: "balance-unavailable", reason: "could not read the Trading Balance right now" });
  if (!snapshot.value) return receiptFor(mention, { ...base, refusalCode: "not-deployed", reason: "the Trading Balance contract is not deployed on this network" });
  const grant = snapshot.value.grants.executor;
  if (!grant) return receiptFor(mention, { ...base, refusalCode: "grant-missing", reason: "no live X grant for this wallet — fund and authorize on /trade-from-x" });
  if (grant.actor !== ctx.session.address) return receiptFor(mention, { ...base, refusalCode: "grant-mismatch", grantId: grant.grantId.toString(), reason: "the wallet's X grant names a different executor" });
  if (grant.expiresAtSec * 1000 <= Date.now()) return receiptFor(mention, { ...base, refusalCode: "grant-expired", grantId: grant.grantId.toString(), reason: "the X grant has expired — renew it on /trade-from-x" });
  if (!isBalanceOnlyXGrant(grant)) return receiptFor(mention, { ...base, grantId: grant.grantId.toString(), refusalCode: "grant-update-required", reason: X_REFUSAL_DETAILS["grant-update-required"] });
  if (instruction.stakeBase > grant.budgetBase) return receiptFor(mention, { ...base, grantId: grant.grantId.toString(), refusalCode: "insufficient-funds", reason: X_REFUSAL_DETAILS["insufficient-funds"] });

  const selected = await liveWindow(ctx.venueId, instruction);
  if (!selected.ok) {
    const window = "market" in selected ? selected.market : undefined;
    return receiptFor(mention, { ...base, refusalCode: selected.code, grantId: grant.grantId.toString(), reason: X_REFUSAL_DETAILS[selected.code],
      ...(window ? { marketId: window.marketId, expirySec: window.expirySec, entryClosesAtSec: noEntryCutoffSec(window),
        ...(selected.code === "window-not-started" ? { nextWindowAtSec: window.tradingStartSec } : {}) } : {}),
    });
  }
  const market = selected.market;

  const target = { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };
  const quote = await marketsProvider.freshQuoteStake(target, instruction.side, instruction.stakeBase);
  const withMarket = { ...base, grantId: grant.grantId.toString(), marketId: market.marketId, asset: market.asset, intervalSec: market.intervalSec, expirySec: market.expirySec };
  if (!quote.ok || quote.stale) return receiptFor(mention, { ...withMarket, refusalCode: "quote-unavailable", reason: "A current quote could not be confirmed." });
  if (!quote.value) return receiptFor(mention, { ...withMarket, refusalCode: "no-liquidity", reason: "No fillable quote was available for this instruction." });

  if (ctx.checkpoint) {
    // The recovery cursor is the slot before the send; Solana has no account nonce.
    const cursor = await readRecoveryCursor();
    if (!cursor.ok) return receiptFor(mention, { ...withMarket, refusalCode: "execution-unavailable", reason: X_REFUSAL_DETAILS["execution-unavailable"] });
    await ctx.checkpoint(receiptFor(mention, { ...withMarket, status: "submitted", executionActor: ctx.session.address,
      poolAddress: market.poolAddress, collateralDecimals: market.decimals, recoveryFromBlock: cursor.value.fromSlot.toString(), expectedNonce: null }));
  }

  const outcome = await ctx.session.submitter.submitOrder({
    market,
    side: instruction.side,
    stakeBase: instruction.stakeBase,
    displayedQuote: quote.value,
    wallet: ctx.session.address,
    route: { kind: "vault-grant", grantId: grant.grantId },
  });
  ctx.log(`mention ${mention.id}: ${outcome.status}`);
  return receiptFor(mention, { ...withMarket, ...outcomeToReceipt(outcome) });
}

export async function resolveVenue(configured: Address | undefined): Promise<Address | null> {
  const venue = await resolveVenueId(configured);
  return venue.ok ? venue.value.venueId : null;
}

export { replyText } from "./reply-format";
export { xReceiptUpsert };
