"use client";

import { usdLine } from "@/features/markets/hero/units";
import { SourceLine } from "@/features/markets/price-source/SourceLine";
import type { SourceLabel } from "@/features/markets/price-source/source-label";
import { TICKER_HUB } from "./copy";
import type { PreIpoFactsView } from "./usePreIpoFacts";
import type { PythIndexRow } from "./usePythIndex";

export interface PreIpoStatsProps {
  /** The token price line the tab's shared price stream gives, already formatted; the dash when none. */
  spot: string;
  spotStale: boolean;
  facts: PreIpoFactsView | null;
  /** Pyth's valuation index for the name (S20); null omits its two rows, never shows a dash for a feed the venue may not read. */
  index: PythIndexRow | null;
  /** The PreStocks source line (S25): the token's mint on Solana Explorer. */
  source: SourceLabel | null;
}

/**
 * The pre-IPO name's figure bar (D-100, S20): Token price · PreStocks mark · Pyth index (only when present) · Token vs
 * mark · Token vs Pyth (only when present) · Holders, then the source line for what is on screen. A missing index
 * changes the bar's shape, not its words: nothing here explains why a row is absent.
 */
export function PreIpoStats({ spot, spotStale, facts, index, source }: PreIpoStatsProps) {
  const t = TICKER_HUB.preIpo;
  return (
    <>
      <dl className="prf-stats">
        <div className="prf-stat">
          <dt>{spotStale ? `${t.tokenPrice} · ${TICKER_HUB.spotStale}` : t.tokenPrice}</dt>
          <dd className="big numbers">{spot}</dd>
        </div>
        <div className="prf-stat">
          <dt title={t.markHint}>{t.mark}</dt>
          <dd className="big numbers">{facts?.markPriceE8 !== undefined ? usdLine(facts.markPriceE8) : TICKER_HUB.dash}</dd>
        </div>
        {index && (
          <div className="prf-stat">
            <dt title={t.indexHint}>{t.index}</dt>
            <dd className="big numbers">{usdLine(index.indexE8)}</dd>
          </div>
        )}
        <div className="prf-stat">
          <dt>{t.premium}</dt>
          <dd className="big numbers">{typeof facts?.premiumBps === "number" ? t.premiumLine(facts.premiumBps) : TICKER_HUB.dash}</dd>
        </div>
        {index && index.premiumBps !== null && (
          <div className="prf-stat">
            <dt>{t.indexPremium}</dt>
            <dd className="big numbers">{t.premiumLine(index.premiumBps)}</dd>
          </div>
        )}
        <div className="prf-stat">
          <dt>{t.holders}</dt>
          <dd className="big numbers">{facts && facts.holders !== null ? t.holdersLine(facts.holders, facts.holdersMonthAgo) : TICKER_HUB.dash}</dd>
        </div>
      </dl>
      <p className="type-caption text-ink-muted">
        <SourceLine label={source} /> · {index ? t.sourceBoth : t.sourcePreStocksOnly}
      </p>
    </>
  );
}
