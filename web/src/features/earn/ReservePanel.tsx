"use client";

import type { ReserveSheet } from "@agari/core/reserves";
import { oneUnit } from "@agari/core/units";
import { EARN } from "./copy";
import { formatSharePrice, money2, sharePriceDeltaPct, utilizationPct } from "./format";
import type { ReserveWords } from "./reserves";

interface ReservePanelProps {
  sheet: ReserveSheet | null;
  symbol: string;
  words: ReserveWords;
  /** The maker vault's extra state: quoting is off without a maker key, whatever the sheet says. */
  status?: string;
}

/**
 * The hero's live panel (`app/earn/page.tsx` L157–207): the share price as the hero number, the delta chip
 * above par, reserve value, utilization with its meter. Every number is the live contract, or the panel says so.
 * The reference's decorative curve beside "Up from 1.0000" drew no data, so it is not here (doc 05 §No fake-data).
 *
 * The reference had one vault; Agari has four reserves keeping the same books, so the words are the tab's and
 * the arithmetic is the sheet's.
 */
export function ReservePanel({ sheet, symbol, words, status }: ReservePanelProps) {
  const { panel } = EARN;
  if (!sheet) {
    return (
      <div className="earn-vault ea-panel">
        <div className="earn-vault-accent" />
        <p className="ea-loading">{panel.loading}</p>
      </div>
    );
  }
  const one = oneUnit(sheet.decimals);
  const delta = sharePriceDeltaPct(sheet.sharePriceRaw, one);
  const below = sheet.supplyShares > 0n && sheet.sharePriceRaw < one;
  return (
    <div className="earn-vault ea-panel">
      <div className="earn-vault-accent" />
      <div className="ea-panel-inner">
        <div className="ea-panel-head">
          <span className="ea-tag">{status ?? (sheet.paused ? words.paused : words.live)}</span>
          <span className="ea-tag ea-tag--brand">{words.brand}</span>
        </div>

        <div className="ea-price-row">
          <div className="ea-price">
            {formatSharePrice(sheet.sharePriceRaw, sheet.decimals)}
            <span className="ea-price-unit">{panel.perShare}</span>
          </div>
          {delta && (
            <span className="earn-chipg ea-chip">
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                <path d="M4 0 L8 7 L0 7 Z" fill="currentColor" />
              </svg>
              {delta}
            </span>
          )}
        </div>
        <div className="ea-since">{below ? panel.belowLaunch(words.noun) : panel.sinceLaunch}</div>

        <div className="earn-hair ea-hair" />

        <div className="ea-metrics">
          <div>
            <div className="ea-k">{words.valueLabel}</div>
            <div className="ea-v">
              {money2(sheet.totalValueBase, sheet.decimals)} <span className="ea-v-unit">{symbol}</span>
            </div>
          </div>
          <div>
            <div className="ea-k">{panel.utilization}</div>
            <div className="ea-v ea-v--accent">{utilizationPct(sheet.utilizationBps)}</div>
            <div className="earn-meter">
              <div className="earn-meter-fill ea-meter-fill" style={{ "--ea-fill": `${Math.min(100, sheet.utilizationBps / 100)}%` } as React.CSSProperties} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
