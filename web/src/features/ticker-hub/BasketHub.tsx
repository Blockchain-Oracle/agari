"use client";

import { basketMembersHeld, isBasketCoverable, type Basket, type BasketSymbol } from "@agari/core/market";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import { useAssetPrice } from "@agari/markets/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/chrome";
import { basketHolding, heldSymbols, tradingBasketWindow } from "@/features/baskets/basket-window";
import { bpsPct, windowText } from "@/features/hedge/calm";
import { useHoldings } from "@/features/hedge/useHoldings";
import { basisRaw, feedRawToOracleRaw, pointsLine } from "@/features/markets/hero/units";
import { MarketCard, useLanesState } from "@/features/markets/lanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { BasketMembers } from "./BasketMembers";
import { TICKER_HUB } from "./copy";
import { usePreIpoFacts, type PreIpoFactsView } from "./usePreIpoFacts";

const USD_DP = 6;
const signedPct = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;

export interface BasketHubViewProps {
  basket: Basket;
  /** The live index at the print scale (points × 10⁸); null before the first read. */
  indexRaw: bigint | null;
  indexStale: boolean;
  facts: PreIpoFactsView | null;
  window: EventMarket | null;
  /** The Window's card, rendered by the caller: the live `MarketCard`, or a canned view on `/dev/basket`. */
  windowCard: ReactNode;
  /** Members this wallet holds; null with no wallet connected. */
  held: ReadonlySet<string> | null;
  heldValueUsdE6: bigint | null;
}

/**
 * The hub's basket variant (S19 §5.2, D-081): the facts bar reads Index · Members · Moved instead of a price and a
 * report date; then the members table, the live basket Window, and "You hold N of M" with Cover and Add deep links.
 * Presentational, so `/dev/basket` renders it in two holding states from fixtures.
 */
export function BasketHubView({ basket, indexRaw, indexStale, facts, window, windowCard, held, heldValueUsdE6 }: BasketHubViewProps) {
  const B = TICKER_HUB.basket;
  const heldMembers = held ? basketMembersHeld(basket, held) : [];
  const coverable = held ? isBasketCoverable(basket, held) : false;
  const move = facts?.move ?? null;
  const value = heldValueUsdE6 === null ? null : `$${formatBaseUnits(heldValueUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
  const holdLine = held === null ? B.hold.connect : heldMembers.length === 0 ? B.hold.none(basket.members.length) : B.hold.some(heldMembers.length, basket.members.length, value);
  return (
    <>
      <div className="prf-bar">
        <dl className="prf-stats">
          <div className="prf-stat">
            <dt title={B.indexHint}>{indexStale ? `${B.index} · ${TICKER_HUB.spotStale}` : B.index}</dt>
            <dd className="big numbers">{indexRaw === null ? TICKER_HUB.dash : pointsLine(indexRaw)}</dd>
          </div>
          <div className="prf-stat">
            <dt>{B.members}</dt>
            <dd className="big">{B.membersLine(basket.members.length)}</dd>
          </div>
          <div className="prf-stat">
            <dt>{B.moved(move ? windowText(move.windowSec) : "")}</dt>
            <dd className="big numbers">{move ? B.movedLine(bpsPct(move.rangeBps), signedPct(move.changeBps)) : B.quiet}</dd>
          </div>
        </dl>
        <p className="type-caption text-ink-muted">{B.source}</p>
      </div>

      <section aria-label={B.table.title}>
        <SectionHeader index="01" title={B.table.title} className="lb-section-head" />
        <BasketMembers basket={basket} members={facts?.members ?? null} held={held} />
      </section>

      <section aria-label={B.window.title}>
        <SectionHeader index="02" title={B.window.title} className="lb-section-head" />
        {window ? <div className="tkh-window markets-main">{windowCard}</div> : <p className="news-quiet">{B.window.none}</p>}
        <div className="tkh-hold">
          <span className="tkh-hold-line type-body">{holdLine}</span>
          {held !== null && heldMembers.length > 0 && (
            window ? (
              <span className="tkh-hold-actions ys-actions">
                {coverable ? (
                  <Link href={marketDeepLink({ marketId: window.marketId, dir: "down" })} className="ys-action" data-side="down" data-cursor="hover">
                    {B.hold.cover}
                  </Link>
                ) : (
                  <span className="type-caption text-ink-muted">{B.hold.coverNeeds}</span>
                )}
                <Link href={marketDeepLink({ marketId: window.marketId, dir: "up" })} className="ys-action" data-side="up" data-cursor="hover">
                  {B.hold.add}
                </Link>
              </span>
            ) : (
              <span className="type-caption text-ink-muted">{B.hold.noWindow}</span>
            )
          )}
        </div>
      </section>
    </>
  );
}

/** The live basket hub for `/tickers/<BASKET>`: the index from the price stream, the facts row, the wallet's members, the trading Window. */
export function BasketHub({ basket }: { basket: Basket }) {
  const symbol: BasketSymbol = basket.symbol;
  const router = useRouter();
  const price = useAssetPrice(symbol);
  const facts = usePreIpoFacts(symbol);
  const venue = useVenue();
  const lanes = useLanesState(venue.venueId);
  const nowMs = useChainNowMs();
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const live = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  const factsRow = facts?.ok ? facts.value : null;
  const window = tradingBasketWindow(lanes.laneSet, symbol, nowMs);
  const holding = holdings?.ok ? basketHolding(basket, holdings.value) : null;
  const open = (marketId: MarketId, side?: Side) => router.push(marketDeepLink({ marketId, dir: side }));
  return (
    <BasketHubView
      basket={basket}
      indexRaw={live ?? factsRow?.indexE8 ?? null}
      indexStale={price?.ok === true && price.stale}
      facts={factsRow}
      window={window}
      windowCard={window ? <MarketCard market={window} nowMs={nowMs} selected={false} onSelect={open} onOpenRoom={() => open(window.marketId)} /> : null}
      held={holdings?.ok ? heldSymbols(holdings.value) : null}
      heldValueUsdE6={holding?.valueUsdE6 ?? null}
    />
  );
}
