import { estPayoutBase } from "@agari/core/claims";
import { isTickerSymbol } from "@agari/core/market";
import type { Address, MarketId, Side } from "@agari/core/types";
import type { SocialFillRow, SocialSettlementRow } from "@agari/db";
import type { FeedTake } from "@/features/takes/protocol";
import type { ActivityItem } from "./protocol";

/**
 * Index rows → `ActivityItem`s. A settlement's verdict follows core's settlement rule (`projection/settle.ts`
 * `outcomeOf`), so the inbox never calls a round a win that the ledger, the profile record and Trader Edge call a loss:
 * nothing held at expiry is no verdict, a void is a void, a payout of zero is a loss, and a payout that lost money
 * overall is still a loss.
 */

const UP_KINDS = new Set([0, 3]);

const asset = (symbol: string | null) => (symbol && isTickerSymbol(symbol) ? symbol : null);
const seconds = (value: string | null) => (value === null ? null : Number(value));

export function fillItem(row: SocialFillRow): ActivityItem {
  return {
    id: `fill:${row.signature}:${row.outer_ix}:${row.inner_ix}:${row.fill_ix}:${row.wallet}`,
    kind: "fill",
    wallet: row.wallet as Address,
    marketId: row.market as MarketId,
    asset: asset(row.symbol),
    intervalSec: row.cadence_sec,
    side: UP_KINDS.has(row.kind) ? "up" : "down",
    lots: row.lots,
    amountBase: row.amount_base,
    signature: row.signature,
    takeId: null,
    atSec: Number(row.ts_sec),
  };
}

export interface SettlementFacts {
  heldUpRaw: bigint;
  heldDownRaw: bigint;
  voided: boolean;
  /** What the held legs pay by the settlement rule (win 1:1, void half), before any redemption. */
  payoutBase: bigint;
  pnlBase: bigint | null;
  verdict: "settled-win" | "settled-loss" | "voided" | null;
}

/** The seat's result at settlement, from the index's lots and cash columns, in base units. */
export function settlementFacts(row: SocialSettlementRow): SettlementFacts {
  const lotBase = row.lot_base === null ? null : BigInt(row.lot_base);
  const heldUpRaw = lotBase === null ? 0n : BigInt(row.held_yes_lots) * lotBase;
  const heldDownRaw = lotBase === null ? 0n : BigInt(row.held_no_lots) * lotBase;
  const voided = row.state === "voided" || row.winner === 2;
  const legs = [heldUpRaw, heldDownRaw].filter((raw) => raw > 0n);
  const payoutBase = voided
    ? legs.reduce((sum, raw) => sum + estPayoutBase(raw, "void"), 0n)
    : row.winner === 0
      ? estPayoutBase(heldUpRaw, "win")
      : row.winner === 1
        ? estPayoutBase(heldDownRaw, "win")
        : 0n;
  const pnlBase = row.cost_base === null || row.proceeds_base === null ? null : BigInt(row.proceeds_base) + payoutBase - BigInt(row.cost_base);
  let verdict: SettlementFacts["verdict"] = null;
  if (legs.length > 0 && lotBase !== null) {
    if (voided) verdict = "voided";
    else if (payoutBase === 0n) verdict = "settled-loss";
    else verdict = pnlBase !== null && pnlBase < 0n ? "settled-loss" : "settled-win";
  }
  return { heldUpRaw, heldDownRaw, voided, payoutBase, pnlBase, verdict };
}

/**
 * One seat on a terminal Window → its verdict, plus (with `payouts`) what happened to the money: still claimable, or
 * paid by the settler's crank. A seat its owner redeemed says nothing more — the owner pressed Claim themselves.
 */
export function settlementItems(row: SocialSettlementRow, options: { payouts: boolean }): ActivityItem[] {
  const facts = settlementFacts(row);
  const base = {
    wallet: row.owner as Address,
    marketId: row.market as MarketId,
    asset: asset(row.symbol),
    intervalSec: row.cadence_sec,
    side: (facts.heldUpRaw > facts.heldDownRaw ? "up" : facts.heldDownRaw > facts.heldUpRaw ? "down" : null) as Side | null,
    lots: String(BigInt(row.held_yes_lots) + BigInt(row.held_no_lots)),
    takeId: null,
  };
  const resolvedSec = seconds(row.resolved_ts_sec) ?? seconds(row.expiry_sec) ?? 0;
  const items: ActivityItem[] = [];
  if (facts.verdict) {
    const amount = facts.verdict === "voided" ? facts.payoutBase : facts.pnlBase;
    items.push({ ...base, id: `settled:${row.market}:${row.owner}`, kind: facts.verdict, amountBase: amount === null ? null : String(amount), signature: null, atSec: resolvedSec });
  }
  if (!options.payouts) return items;
  if (!row.redeemed && facts.payoutBase > 0n) {
    items.push({ ...base, id: `claimable:${row.market}:${row.owner}`, kind: "claimable", amountBase: String(facts.payoutBase), signature: null, atSec: resolvedSec });
  }
  if (row.redeemed_by_crank && BigInt(row.payout_base) > 0n) {
    items.push({
      ...base,
      id: `paid:${row.market}:${row.owner}`,
      kind: "paid-automatically",
      amountBase: row.payout_base,
      signature: row.last_signature,
      atSec: seconds(row.last_ts_sec) ?? resolvedSec,
    });
  }
  return items;
}

export function takeItem(take: FeedTake): ActivityItem {
  return {
    id: `take:${take.id}`,
    kind: "take",
    wallet: take.author,
    marketId: take.marketId,
    asset: asset(take.asset),
    intervalSec: take.intervalSec,
    side: take.side,
    lots: null,
    amountBase: null,
    signature: null,
    takeId: take.id,
    atSec: Math.floor(take.createdAtMs / 1000),
  };
}

/** Newest first, ties broken by id so a poll never reorders equal-time rows; capped. */
export function mergeItems(groups: readonly ActivityItem[][], limit: number): ActivityItem[] {
  return groups
    .flat()
    .sort((a, b) => b.atSec - a.atSec || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, limit);
}
