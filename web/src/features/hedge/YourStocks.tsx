"use client";

import { TICKERS, type TickerSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { SectionHeader } from "@/components/chrome";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { useLanesState } from "@/features/markets/lanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { HEDGE } from "./copy";
import { DropBellToggle } from "./DropBellToggle";
import { hedgeTarget } from "./hedge-target";
import { useHoldings, type HoldingView } from "./useHoldings";
import "./hedge.css";

const SHARES_DP = 8;
const SHARES_SHOWN_DP = 4;
const USD_DP = 6;

interface Group {
  underlying: TickerSymbol;
  holdings: HoldingView[];
  valueUsdE6: bigint | null;
}

/** Holdings grouped by the company they track, largest first; a group's value is null if any token in it is unpriced. */
export function groupHoldings(holdings: readonly HoldingView[]): Group[] {
  const groups = new Map<TickerSymbol, HoldingView[]>();
  for (const h of holdings) groups.set(h.underlying, [...(groups.get(h.underlying) ?? []), h]);
  return [...groups].map(([underlying, list]) => ({
    underlying,
    holdings: list,
    valueUsdE6: list.every((h) => h.exposureUsdE6 !== null) ? list.reduce((sum, h) => sum + h.exposureUsdE6!, 0n) : null,
  }));
}

const tokensText = (list: HoldingView[]) => list.map((h) => `${formatBaseUnits(h.sharesE8, SHARES_DP, { maxDp: SHARES_SHOWN_DP, minDp: 0 })} ${h.symbol}`).join(" + ");

/**
 * "Your stocks" (plan Step 4): every stock token the wallet holds, read-only, each with both Agari bets offered — cover
 * it with Down, add to it with Up — on the Window the cover card would pick, or an honest "no open market" line.
 * Presentational, so `/dev/hedge` renders it from canned holdings; `YourStocks` below reads the hooks.
 */
export function YourStocksList({ holdings, laneSet, nowMs, index }: { holdings: readonly HoldingView[]; laneSet: LaneSet | null; nowMs: number; index: string }) {
  const groups = groupHoldings(holdings);
  return (
    <section className="flex flex-col gap-4" aria-label={HEDGE.stocks.title}>
      <SectionHeader index={index} title={HEDGE.stocks.title} />
      <p className="type-body text-ink-secondary">{HEDGE.stocks.intro}</p>
      {groups.length === 0 ? (
        <p className="type-body text-ink-muted">{HEDGE.stocks.empty}</p>
      ) : (
        <ul className="ys-list">
          {groups.map((g) => {
            const target = hedgeTarget(laneSet, g.underlying, nowMs);
            const value = g.valueUsdE6 === null ? null : `$${formatBaseUnits(g.valueUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
            return (
              <li key={g.underlying} className="ys-row">
                <AssetDisc asset={g.underlying} className="ys-mark" />
                <div className="ys-text">
                  <span className="ys-name">{TICKERS[g.underlying].name}</span>
                  <span className="ys-line">{value === null ? tokensText(g.holdings) : `${tokensText(g.holdings)} ≈ ${value}`}</span>
                  <DropBellToggle asset={g.underlying} />
                </div>
                {target ? (
                  <div className="ys-actions">
                    <Link href={marketDeepLink({ marketId: target.market.marketId, dir: "down" })} className="ys-action" data-side="down">
                      {HEDGE.stocks.cover}
                    </Link>
                    <Link href={marketDeepLink({ marketId: target.market.marketId, dir: "up" })} className="ys-action" data-side="up">
                      {HEDGE.stocks.add}
                    </Link>
                  </div>
                ) : (
                  <span className="ys-none">{HEDGE.stocks.none}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {groups.length > 0 && <p className="hg-banner-foot ys-foot">{HEDGE.bell.foot}</p>}
      <p className="hg-banner-foot ys-foot">{HEDGE.stocks.foot}</p>
    </section>
  );
}

/** The live section for the connected wallet; renders nothing until the first read answers (the page's own gate handles no wallet). */
export function YourStocks({ index }: { index: string }) {
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const venue = useVenue();
  const lanes = useLanesState(venue.venueId);
  const nowMs = useChainNowMs();
  if (!holdings?.ok) return null;
  return <YourStocksList holdings={holdings.value} laneSet={lanes.laneSet} nowMs={nowMs} index={index} />;
}
