"use client";

import type { LeverageReserveState } from "@agari/core/leverage";
import type { ParlayReserveState } from "@agari/core/parlay";
import type { RangeReserveState } from "@agari/core/range";
import { boostSheet, parlaySheet, rangeSheet, type ProviderShares, type ReserveKind, type ReserveSheet } from "@agari/core/reserves";
import { isOk, mapReading, type Reading } from "@agari/core/schemas";
import { useBalanceSheet, useLeverageReserve, useLeverageShares, useParlayReserve, useParlayShares, useRangeReserve, useRangeShares } from "@agari/markets/react";
import { useEffect, useState, type ReactNode } from "react";
import { SectionHead } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useWalletSession } from "@/lib/wallet-session";
import { boostBounds, parlayBounds, rangeBounds, type BoundRow } from "./bounds";
import { EARN } from "./copy";
import { Hero } from "./Hero";
import { ReserveBounds } from "./ReserveBounds";
import { RESERVES, type ReserveWords } from "./reserves";
import { PositionCard, SupplyCard } from "./SupplyCards";
import { useReserveWrites } from "./useReserveWrites";

type HouseKind = Exclude<ReserveKind, "maker">;

/** One reserve's sheet and the bounds it publishes, from whichever program this tab belongs to. */
interface HouseReading {
  sheet: ReserveSheet;
  rows: BoundRow[];
}

/**
 * The active tab's reserve, as one sheet and one set of bounds.
 *
 * All three hooks are called (the rules of hooks leave no choice) but only the showing tab's is enabled, so the
 * other two sit on whatever the query cache already holds and poll nothing.
 */
function useHouseReserve(kind: HouseKind, words: ReserveWords, symbol: string): Reading<HouseReading | null> | null {
  const range = useRangeReserve(kind === "range");
  const parlay = useParlayReserve(kind === "parlay");
  const boost = useLeverageReserve(kind === "boost");
  if (kind === "range") return range && mapReading(range, (state) => house(state && rangeSheet(state), state, words, symbol, rangeBounds));
  if (kind === "parlay") return parlay && mapReading(parlay, (state) => house(state && parlaySheet(state), state, words, symbol, parlayBounds));
  return boost && mapReading(boost, (state) => house(state && boostSheet(state), state, words, symbol, boostBounds));
}

function house<S>(sheet: ReserveSheet | null, state: S | null, words: ReserveWords, symbol: string, bounds: (state: S, sheet: ReserveSheet, words: ReserveWords, symbol: string) => BoundRow[]): HouseReading | null {
  return sheet === null || state === null ? null : { sheet, rows: bounds(state, sheet, words, symbol) };
}

function useHouseShares(kind: HouseKind): Reading<ProviderShares> | null {
  const { address } = useWalletSession();
  const range = useRangeShares(kind === "range" ? address : null);
  const parlay = useParlayShares(kind === "parlay" ? address : null);
  const boost = useLeverageShares(kind === "boost" ? address : null);
  return kind === "range" ? range : kind === "parlay" ? parlay : boost;
}

/**
 * `/earn`'s house-reserve tabs: range and moonshot, parlay, boost.
 *
 * All three keep the same books and the same two liquidity instructions as the maker vault, so this is the same
 * hero, the same two cards and the reserve's own parameters where the vault shows its Windows.
 */
export function HouseEarn({ kind, symbol, tabs }: { kind: HouseKind; symbol: string; tabs: ReactNode }) {
  const words = RESERVES[kind];
  const reading = useHouseReserve(kind, words, symbol);
  const value = reading && isOk(reading) ? reading.value : null;
  const deployed = reading === null || value !== null;
  return (
    <>
      {deployed && <Hero words={words} sheet={value?.sheet ?? null} symbol={symbol} />}
      {tabs}
      <ReadingBoundary reading={reading} shape="plate">
        {(state) => (state ? <Page kind={kind} words={words} reading={state} symbol={symbol} /> : <NotOnThisCluster words={words} />)}
      </ReadingBoundary>
    </>
  );
}

function Page({ kind, words, reading, symbol }: { kind: HouseKind; words: ReserveWords; reading: HouseReading; symbol: string }) {
  const { address } = useWalletSession();
  const balance = useBalanceSheet(address);
  const shares = useHouseShares(kind);
  const writes = useReserveWrites(kind);
  const [message, setMessage] = useState("");
  useEffect(() => setMessage(writes.msg), [writes.msg]);

  const walletBase = balance && isOk(balance) ? balance.value.spendableBase : null;
  const held = shares && isOk(shares) ? shares.value : { shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n };
  const { sheet } = reading;
  const { sections } = EARN;

  return (
    <div className="container ea-main">
      <SectionHead number={sections.supply.number} title={words.supplyTitle} meta={words.supplyMeta} />
      {sheet.paused && (
        <div className="ea-paused">
          <p className="ea-paused-title">{EARN.paused.title}</p>
          <p className="ea-paused-body">{EARN.paused.reserveBody}</p>
        </div>
      )}
      <div className="ea-cards">
        <SupplyCard connected={address !== null} sheet={sheet} symbol={symbol} walletBase={walletBase} busy={writes.busy} onSupply={writes.supply} onMessage={setMessage} />
        <PositionCard connected={address !== null} sheet={sheet} words={words} symbol={symbol} shares={held.shares} worthBase={held.worthBase} suppliedBase={held.suppliedBase} withdrawnBase={held.withdrawnBase} busy={writes.busy} onWithdraw={writes.withdraw} />
      </div>

      {message && <p className={message.includes("✓") ? "ea-msg" : "ea-msg ea-msg--err"}>{message}</p>}

      <SectionHead number={sections.windows.number} title={words.boundsTitle} meta={words.boundsMeta} />
      <ReserveBounds rows={reading.rows} risk={words.risk} />
    </div>
  );
}

/** The program is not on this cluster: the reserve's own words, and what it depends on. */
function NotOnThisCluster({ words }: { words: ReserveWords }) {
  const { notDeployed } = EARN;
  return (
    <div className="container">
      <div className="ea-bounds">
        <p className="ea-bound-note">{words.blurb}</p>
        <p className="ea-risk">{notDeployed.reserve(words.label)}</p>
      </div>
    </div>
  );
}
