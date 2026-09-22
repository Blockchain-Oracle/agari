"use client";

import { BASKET_SYMBOLS, BASKETS, basketMembersHeld, isBasketCoverable, PRE_IPO_SYMBOLS, TICKERS, type PreIpoSymbol, type TickerSymbol } from "@agari/core/market";
import type { LaneSet } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { SectionHeader } from "@/components/chrome";
import { basketHolding, heldSymbols, tradingBasketWindow } from "@/features/baskets/basket-window";
import { RECORD } from "@/features/desk/copy-record";
import { tokens as deskTokens } from "@/features/desk/format";
import { useDeskView } from "@/features/desk/useDesk";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { useLanesState } from "@/features/markets/lanes";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { usePreIpoFactsAll, type PreIpoMove } from "@/features/ticker-hub/usePreIpoFacts";
import { bpsPct, holdsPreIpo, isCalm, windowText } from "./calm";
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
/** S21 (plan §5.2): what the wallet's desk holds of each pre-IPO name, raw 9 dp; absent = no desk or not read. */
export type DeskHeld = Partial<Record<PreIpoSymbol, bigint>>;
const isPreIpo = (symbol: string): symbol is PreIpoSymbol => (PRE_IPO_SYMBOLS as readonly string[]).includes(symbol);

export interface YourStocksListProps {
  holdings: readonly HoldingView[];
  laneSet: LaneSet | null;
  nowMs: number;
  index: string;
  /** Each pre-IPO name's measured move (plan §2); absent = not read, so nothing is called calm. */
  movement?: Record<string, PreIpoMove | null | undefined>;
  desk?: DeskHeld;
}

/** "In your wallet 4.2 · In your desk 0.34": the two purses as separate lines, never one figure (plan §5.3). */
function purseLine(group: Group, desk: DeskHeld | undefined): string | null {
  if (!desk || !isPreIpo(group.underlying)) return null;
  const inDesk = desk[group.underlying];
  if (inDesk === undefined) return null;
  const S = RECORD.hooks.stocks;
  return `${S.inWallet(tokensText(group.holdings))} · ${S.inDesk(deskTokens(inDesk))}`;
}

export function YourStocksList({ holdings, laneSet, nowMs, index, movement, desk }: YourStocksListProps) {
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
            const move = movement?.[g.underlying] ?? null;
            const calm = isCalm(move);
            return (
              <li key={g.underlying} className="ys-row">
                <AssetDisc asset={g.underlying} className="ys-mark" />
                <div className="ys-text">
                  <span className="ys-name">{TICKERS[g.underlying].name}</span>
                  <span className="ys-line">{value === null ? tokensText(g.holdings) : `${tokensText(g.holdings)} ≈ ${value}`}</span>
                  {purseLine(g, desk) && <span className="ys-line">{purseLine(g, desk)}</span>}
                  {move && !calm && <span className="ys-move">{HEDGE.stocks.moved(bpsPct(move.rangeBps), windowText(move.windowSec))}</span>}
                  <DropBellToggle asset={g.underlying} />
                </div>
                {calm && move ? (
                  <span className="ys-none">{HEDGE.stocks.calm(TICKERS[g.underlying].name, windowText(move.windowSec))}</span>
                ) : target ? (
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
      <YourBaskets holdings={holdings} laneSet={laneSet} nowMs={nowMs} movement={movement} />
      <DeskHold holdings={holdings} />
    </section>
  );
}

/**
 * "Your baskets" (S19 A6): every basket two or more held members sit in, with what is held and the same two bets on
 * the basket's own Window. One held member is covered on its own name above, and the block says so once.
 */
function YourBaskets({ holdings, laneSet, nowMs, movement }: Omit<YourStocksListProps, "index">) {
  const held = heldSymbols(holdings);
  const baskets = BASKET_SYMBOLS.map((s) => BASKETS[s]).filter((b) => isBasketCoverable(b, held));
  const oneOnly = baskets.length === 0 && BASKET_SYMBOLS.some((s) => basketMembersHeld(BASKETS[s], held).length === 1);
  if (baskets.length === 0 && !oneOnly) return null;
  return (
    <div className="ys-baskets" aria-label={HEDGE.baskets.title}>
      <SectionHeader index="" title={HEDGE.baskets.title} />
      <p className="type-body text-ink-secondary">{HEDGE.baskets.intro}</p>
      {oneOnly ? (
        <p className="type-body text-ink-muted">{HEDGE.baskets.one}</p>
      ) : (
        <ul className="ys-list">
          {baskets.map((basket) => {
            const own = basketHolding(basket, holdings);
            const window = tradingBasketWindow(laneSet, basket.symbol, nowMs);
            const value = own.valueUsdE6 === null ? null : `$${formatBaseUnits(own.valueUsdE6, USD_DP, { maxDp: 0, minDp: 0 })}`;
            const move = movement?.[basket.symbol] ?? null;
            const calm = isCalm(move);
            return (
              <li key={basket.symbol} className="ys-row">
                <AssetDisc asset={basket.symbol} className="ys-mark" />
                <div className="ys-text">
                  <span className="ys-name">{basket.name}</span>
                  <span className="ys-line">{HEDGE.baskets.holds(own.members.length, basket.members.length, value)} · {tokensText(own.holdings)}</span>
                  {move && !calm && <span className="ys-move">{HEDGE.stocks.moved(bpsPct(move.rangeBps), windowText(move.windowSec))}</span>}
                </div>
                {calm && move ? (
                  <span className="ys-none">{HEDGE.baskets.calm(basket.name, windowText(move.windowSec))}</span>
                ) : window ? (
                  <div className="ys-actions">
                    <Link href={marketDeepLink({ marketId: window.marketId, dir: "down" })} className="ys-action" data-side="down">
                      {HEDGE.baskets.cover}
                    </Link>
                    <Link href={marketDeepLink({ marketId: window.marketId, dir: "up" })} className="ys-action" data-side="up">
                      {HEDGE.baskets.add}
                    </Link>
                  </div>
                ) : (
                  <span className="ys-none">{HEDGE.baskets.none}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** S21 (plan §5.2): "Let a desk hold this basket" for every basket the wallet holds one or more members of. */
function DeskHold({ holdings }: { holdings: readonly HoldingView[] }) {
  const held = heldSymbols(holdings);
  const baskets = BASKET_SYMBOLS.map((s) => BASKETS[s]).filter((b) => basketMembersHeld(b, held).length >= 1);
  if (baskets.length === 0) return null;
  const S = RECORD.hooks.stocks;
  return (
    <div className="ys-actions" aria-label={S.hold}>
      {baskets.map((basket) => (
        <Link key={basket.symbol} href={`/desk/new?basket=${basket.symbol}`} className="ys-action" title={S.holdWhy} data-cursor="hover">
          {S.hold} · {basket.name}
        </Link>
      ))}
    </div>
  );
}

function deskHeldOf(view: { snapshot: { holdings: Array<{ symbol: PreIpoSymbol; raw: string }> } | null; paper: { positions: Record<string, string> } | null; chain: { tokens: Array<{ symbol: PreIpoSymbol | null; raw: string }> } | null }): DeskHeld {
  const out: DeskHeld = {};
  if (view.snapshot) for (const h of view.snapshot.holdings) out[h.symbol] = BigInt(h.raw);
  else if (view.chain) for (const t of view.chain.tokens) if (t.symbol) out[t.symbol] = BigInt(t.raw);
  else if (view.paper) for (const [s, raw] of Object.entries(view.paper.positions)) out[s as PreIpoSymbol] = BigInt(raw);
  return out;
}

/** The live section for the connected wallet; renders nothing until the first read answers (the page's own gate handles no wallet). */
export function YourStocks({ index }: { index: string }) {
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const venue = useVenue();
  const lanes = useLanesState(venue.venueId);
  const nowMs = useChainNowMs();
  const facts = usePreIpoFactsAll(holdings?.ok === true && holdsPreIpo(holdings.value));
  // The desk's own page read (one TanStack key): what it holds of each name, read-only, as its own line.
  const deskRead = useDeskView(address, address, address !== null);
  if (!holdings?.ok) return null;
  const movement = facts?.ok ? Object.fromEntries(Object.entries(facts.value).map(([symbol, row]) => [symbol, row.move ?? null])) : undefined;
  const desk: DeskHeld | undefined = deskRead?.ok && deskRead.value.desk ? deskHeldOf(deskRead.value) : undefined;
  return <YourStocksList holdings={holdings.value} laneSet={lanes.laneSet} nowMs={nowMs} index={index} movement={movement} desk={desk} />;
}
