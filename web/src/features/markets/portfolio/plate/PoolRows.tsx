"use client";

import { formatBaseUnits } from "@masayume/core/units";
import type { ReactNode } from "react";
import { Chevron } from "./Chevron";
import { PLATE } from "./copy";
import type { Pool, PoolId } from "./useMoney";
import "./ledger-plate.css";

function Body({ pool, decimals, symbol, disclosureAction }: { pool: Pool; decimals: number; symbol: string; disclosureAction?: string }) {
  return (
    <div className="pool-body">
      {/* The note stays ON the row, not behind a hover: it explains where money is and why it cannot be bet here. */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="pool-label">{pool.label}</span>
          {pool.blockedReason ? <span className="pool-blocked">{pool.blockedReason}</span> : null}
        </div>
        <p className="pool-note">{pool.note}</p>
        {disclosureAction && <span className="pool-action">{disclosureAction}</span>}
      </div>
      {/* The amount IS the row. */}
      <div className="pool-amount">
        {pool.amountBase === null ? "—" : formatBaseUnits(pool.amountBase, decimals, { maxDp: 2, minDp: 2 })}
        <span className="pool-unit">{symbol}</span>
      </div>
    </div>
  );
}

interface PoolRowsProps {
  pools: Pool[];
  decimals: number;
  symbol: string;
  /** Controls that belong to a pool, revealed by clicking that pool's own row. */
  panels?: Partial<Record<PoolId, ReactNode>>;
}

/**
 * The other places your money is — rows, not cards, and never merged into the balance above.
 * Ported from `reference/yosuku/components/portfolio/PoolRows.tsx`: a row with controls IS its own disclosure.
 */
export function PoolRows({ pools, decimals, symbol, panels = {} }: PoolRowsProps) {
  if (!pools.length) return null;
  return (
    <div className="pool-rows">
      <div className="lp-eyebrow">{PLATE.poolsEyebrow}</div>
      <div className="mt-1">
        {pools.map((pool) => {
          const panel = panels[pool.id];
          if (!panel) {
            return (
              <div key={pool.id} className="pool-line">
                <Body pool={pool} decimals={decimals} symbol={symbol} />
                {pool.action && !pool.blockedReason ? (
                  <a href={pool.action.href} className="pool-action" data-cursor="hover">
                    {pool.action.label}
                    <span className="sr-only"> {pool.label}</span>
                  </a>
                ) : null}
              </div>
            );
          }
          return (
            <details key={pool.id} className="pool-line">
              <summary className="pool-summary">
                <div className="min-w-0 flex-1">
                  <Body pool={pool} decimals={decimals} symbol={symbol} disclosureAction={!pool.blockedReason ? pool.action?.label : undefined} />
                </div>
                <span className="pool-chevron">
                  <Chevron />
                </span>
              </summary>
              <div className="plate-rows pool-panel">{panel}</div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
