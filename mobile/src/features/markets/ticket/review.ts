import { formatCadence } from "@agari/core/copy";
import { priceRawToBps, formatBaseUnits } from "@agari/core/units";
import type { TicketComposer } from "@/features/markets/ticket/useTicketComposer";
import { laneAssetLabel } from "@/features/markets/lanes/lane-view";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { LEVERAGE } from "@/features/leverage/copy";
import type { QuoteLine } from "~/components/kit";
import { NATIVE_MARKETS } from "../copy";

export interface TicketReview {
  title: string;
  lines: QuoteLine[];
  /** The most the order can cost, shown in the loss ink on the review. */
  maxLoss: string;
  confirmLabel: string;
  /** The armed button's label on the composer ("Buy UP for 5.00 tUSDC"). */
  cta: string;
}

const Q = NATIVE_MARKETS.quote;

/**
 * The exact numbers the order is built from, for the review before the slide: a plain order's quote (contracts, average
 * price, expected cost, the escrow at the protective limit, the payout if right, the seat deposit), a boost's (stake,
 * multiple, what the reserve fronts, what the owner collects), or the private desk's. Null until there is a quote.
 */
export function ticketReview(c: TicketComposer): TicketReview | null {
  const { side, decimals, symbol, market } = c;
  if (!side) return null;
  const word = SIDE_WORD[side];
  const money = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;
  const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0 });
  const cents = (bps: number) => `${Math.round(bps / 100)}¢`;
  const title = NATIVE_MARKETS.confirmTitle(word, laneAssetLabel(market.asset, market.lane), formatCadence(market.intervalSec));

  if (c.boosted) {
    const q = c.boost.quote;
    if (!q) return null;
    return {
      title,
      lines: [
        { label: Q.stake, value: money(q.stakeBase) },
        { label: Q.leverage, value: LEVERAGE.multiple(c.multiple), tone: "accent", hint: LEVERAGE.strip.knockout(c.multiple) },
        { label: Q.contracts, value: contracts(q.quantityRaw) },
        { label: Q.avgPrice, value: cents(priceRawToBps(q.priceRaw, decimals)) },
        { label: Q.fronted, value: money(q.frontedBase) },
        { label: Q.payout, value: money(q.winIfRightBase), tone: "profit" },
      ],
      maxLoss: money(q.stakeBase),
      confirmLabel: `Slide to buy ${word} ${LEVERAGE.multiple(c.multiple)}`,
      cta: `${LEVERAGE.cta.buy(word, c.multiple)} ${money(q.stakeBase)}`,
    };
  }

  if (c.privateMode) {
    const q = c.priv.quote;
    if (!q) return null;
    return {
      title: `${title} · ${NATIVE_MARKETS.quote.private}`,
      lines: [
        { label: Q.route, value: NATIVE_MARKETS.quote.private, tone: "accent" },
        { label: Q.contracts, value: contracts(q.quantityRaw) },
        { label: Q.avgPrice, value: cents(priceRawToBps(q.priceRaw, decimals)) },
        { label: Q.expected, value: money(q.costBase) },
        { label: Q.payout, value: money(q.quantityRaw), tone: "profit" },
      ],
      maxLoss: money(q.costBase),
      confirmLabel: `Slide to buy ${word} privately`,
      cta: `Buy ${word} privately for ${money(q.costBase)}`,
    };
  }

  const q = c.displayed;
  if (!q) return null;
  const lines: QuoteLine[] = [
    { label: Q.contracts, value: contracts(q.contractsRaw) },
    { label: Q.avgPrice, value: cents(q.avgPriceBps) },
    { label: Q.expected, value: money(q.expectedCostBase) },
    { label: Q.escrow, value: money(q.maxCostBase) },
    { label: Q.payout, value: money(q.payoutIfRightBase), tone: "profit" },
  ];
  if (c.depositBase > 0n) lines.push({ label: Q.seat, value: money(c.depositBase), tone: "muted", hint: "comes back when the Window settles" });
  return {
    title,
    lines,
    maxLoss: money(q.maxCostBase),
    confirmLabel: `Slide to buy ${word}`,
    cta: `Buy ${word} for ${money(q.maxCostBase)}`,
  };
}
