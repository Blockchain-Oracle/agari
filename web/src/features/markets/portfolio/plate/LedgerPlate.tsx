"use client";

import { formatBaseUnits } from "@masayume/core/units";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PLATE } from "./copy";
import type { Money } from "./useMoney";
import "./ledger-plate.css";

const fmt2 = (base: bigint, decimals: number) => formatBaseUnits(base, decimals, { maxDp: 2, minDp: 2 });

/** One leg of the balance, tied to its segment by colour so the bar needs no legend of its own. */
function Leg({ leg, label, value }: { leg: "wallet" | "account"; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("lp-leg-dot", leg === "wallet" ? "lp-leg-dot--wallet" : "lp-leg-dot--account")} />
      <span className="lp-leg-label">{label}</span>
      <span className="lp-leg-value">{value}</span>
    </div>
  );
}

interface LedgerPlateProps {
  money: Money;
  symbol: string;
  openBets: number;
  settled: number;
  onPrimary: () => void;
  /** Task rows and the pool list live inside this plate: the account is the parent, they are its children. */
  children?: ReactNode;
}

/**
 * The one thing a person arrives at this page to find out: how much can I bet, right now.
 * Ported from `reference/yosuku/components/portfolio/BalancePlate.tsx`. The wallet plus the Trading
 * Balance, because a bet routes to either; everything that is NOT spendable here is named under it
 * and listed as its own row below, never merged into the figure.
 */
export function LedgerPlate({ money, symbol, openBets, settled, onPrimary, children }: LedgerPlateProps) {
  const { decimals } = money;
  const empty = money.walletBase === 0n && money.accountBase === 0n;
  const total = money.walletBase + money.accountBase;
  const walletPct = total > 0n ? Number((money.walletBase * 100n) / total) : 0;
  /** Money in the other pools: real, yours, just not spendable on this page. */
  const elsewhere = money.pools.reduce((sum, pool) => sum + (pool.amountBase ?? 0n), 0n);

  return (
    <div className="ledger-plate">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="lp-eyebrow">{PLATE.eyebrow}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("lp-figure", !money.totalReady && "lp-figure--pending")}>{money.totalUnknown ? "0.00" : fmt2(money.readyToBetBase, decimals)}</span>
            <span className="lp-unit">{symbol}</span>
          </div>
          {/* The headline is what you can BET. A page that shows 14.81 while 19 sits elsewhere reads
              as if it lost your money, so state the whole amount. One line, no explainer paragraph. */}
          {elsewhere > 0n ? (
            <div className="lp-elsewhere">
              <span className="lp-elsewhere-ink">{fmt2(money.readyToBetBase + elsewhere, decimals)}</span> {PLATE.yours}
              {" · "}
              <span className="lp-elsewhere-ink">{fmt2(elsewhere, decimals)}</span> {PLATE.elsewhere}
            </div>
          ) : null}
        </div>

        <button type="button" onClick={onPrimary} className="btn btn-primary shrink-0 max-sm:w-full" data-cursor="hover">
          {empty ? PLATE.getTest : PLATE.addMoney}
        </button>
      </div>

      {/* A proportion bar, not a spec strip: the split is legible before any number is read. Two
          segments, because two is the honest number of places this money sits. */}
      <div className="mt-4">
        <div className="lp-bar">
          <div className="lp-bar-wallet" style={{ width: `${walletPct}%` }} />
          <div className="lp-bar-account" style={{ width: `${100 - walletPct}%` }} />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1">
          <Leg leg="wallet" label={PLATE.inWallet} value={fmt2(money.walletBase, decimals)} />
          <Leg leg="account" label={PLATE.inAccount} value={fmt2(money.accountBase, decimals)} />
          <div className="lp-counts">
            <span className="lp-counts-ink">{openBets}</span> {PLATE.open}
            <span className="lp-counts-sep">·</span>
            <span className="lp-counts-ink">{settled}</span> {PLATE.settled}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
