import { formatCadence } from "@agari/core/copy";
import type { Signature } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { marketDeepLink, txUrl } from "@agari/core/urls";
import type { FeedTake } from "@/features/takes/protocol";
import { ACTIVITY, LIFECYCLE } from "./copy";
import type { ActivityItem } from "./protocol";

export interface MoneyUnits {
  /** Collateral decimals from the boot read; null until known, and then no amount is printed rather than a guess. */
  decimals: number | null;
  symbol: string;
}

export type Tone = "positive" | "negative" | "neutral";

export interface ItemView {
  title: string;
  tone: Tone;
  href: string | null;
  external: boolean;
}

/** "TSLA 5m", the Window's name everywhere a row or a notification mentions one. */
export function windowName(item: Pick<ActivityItem, "asset" | "intervalSec">): string {
  if (!item.asset) return ACTIVITY.unknownWindow;
  return item.intervalSec ? `${item.asset} ${formatCadence(item.intervalSec)}` : item.asset;
}

/** Exact base units with the collateral symbol; a PnL carries its sign. */
export function moneyText(amountBase: string | null, units: MoneyUnits, signed = false): string | null {
  if (amountBase === null || units.decimals === null) return null;
  return `${formatBaseUnits(BigInt(amountBase), units.decimals, { signed })} ${units.symbol}`;
}

const sideWord = (item: ActivityItem) => (item.side ? ACTIVITY.side[item.side] : "");

const TONE: Record<ActivityItem["kind"], Tone> = {
  fill: "neutral",
  "resting-filled": "neutral",
  "settled-win": "positive",
  "settled-loss": "negative",
  voided: "neutral",
  claimable: "positive",
  "paid-automatically": "positive",
  take: "neutral",
  copied: "neutral",
};

/** A row's headline, tag tone and destination: the transaction when there is one, else the Window, else Portfolio's Claim. */
export function describeItem(item: ActivityItem, units: MoneyUnits, take: FeedTake | undefined): ItemView {
  const window = windowName(item);
  const tx = item.signature ? { href: txUrl(item.signature as Signature), external: true } : null;
  const market = item.marketId ? { href: marketDeepLink({ marketId: item.marketId }), external: false } : { href: null, external: false };
  const row = ACTIVITY.row;
  const view = (title: string, target: { href: string | null; external: boolean }): ItemView => ({ title, tone: TONE[item.kind], ...target });
  switch (item.kind) {
    case "fill":
      return view(row.fill(window, sideWord(item), moneyText(item.amountBase, units)), tx ?? market);
    case "resting-filled":
      return view(row.restingFilled(window, sideWord(item), moneyText(item.amountBase, units)), tx ?? market);
    case "settled-win":
      return view(row.win(window, moneyText(item.amountBase, units, true)), market);
    case "settled-loss":
      return view(row.loss(window, moneyText(item.amountBase, units, true)), market);
    case "voided":
      return view(row.voided(window, moneyText(item.amountBase, units)), market);
    case "claimable":
      return view(row.claimable(window, moneyText(item.amountBase, units)), { href: "/portfolio", external: false });
    case "paid-automatically":
      return view(row.paid(window, moneyText(item.amountBase, units)), tx ?? market);
    case "take":
      return view(take?.caption ? row.take(take.caption) : row.takeNoNote(window, sideWord(item)), market);
    case "copied":
      return view(row.copied(window), tx ?? market);
  }
}

/**
 * The notification a lifecycle event raises, or null for kinds that raise none (a take is not about you). A win whose
 * payout is still in the seat arrives with its claimable twin; `claimBase` folds the two into one notification.
 */
export function notificationOf(item: ActivityItem, units: MoneyUnits, claimBase: string | null = null): { title: string; body: string } | null {
  const window = windowName(item);
  switch (item.kind) {
    case "fill":
      return LIFECYCLE.fill(window, sideWord(item));
    case "resting-filled":
      return LIFECYCLE.restingFilled(window, sideWord(item));
    case "settled-win":
      return claimBase !== null ? LIFECYCLE.winClaimable(window, moneyText(claimBase, units)) : LIFECYCLE.win(window, moneyText(item.amountBase, units, true));
    case "settled-loss":
      return LIFECYCLE.loss(window, moneyText(item.amountBase, units, true));
    case "voided":
      return LIFECYCLE.voided(window, moneyText(item.amountBase, units));
    case "claimable":
      return LIFECYCLE.claimable(window, moneyText(item.amountBase, units));
    case "paid-automatically":
      return LIFECYCLE.paid(window, moneyText(item.amountBase, units));
    case "copied":
      return LIFECYCLE.copied(window);
    case "take":
      return null;
  }
}
