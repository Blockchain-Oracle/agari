import { boostSheet, parlaySheet, rangeSheet, type ProviderShares, type ReserveKind, type ReserveSheet } from "@agari/core/reserves";
import { isOk, mapReading, type Reading } from "@agari/core/schemas";
import { useBalanceSheet, useLeverageReserve, useLeverageShares, useParlayReserve, useParlayShares, useRangeReserve, useRangeShares } from "@agari/markets/react";
import { useEffect, useState, type ReactNode } from "react";
import { boostBounds, parlayBounds, rangeBounds, type BoundRow } from "@/features/earn/bounds";
import { EARN } from "@/features/earn/copy";
import { RESERVES, type ReserveWords } from "@/features/earn/reserves";
import { useReserveWrites } from "@/features/earn/useReserveWrites";
import { useWalletSession } from "@/lib/wallet-session";
import { ReadingView } from "~/components/kit";
import { EarnMain } from "./EarnMain";
import { EarnHero } from "./EarnParts";
import { NotOnThisCluster, ReserveBounds } from "./WindowsTable";

type HouseKind = Exclude<ReserveKind, "maker">;

/** One reserve's sheet and the bounds it publishes, from whichever program this tab belongs to. */
interface HouseReading {
  sheet: ReserveSheet;
  rows: BoundRow[];
}

function house<S>(sheet: ReserveSheet | null, state: S | null, words: ReserveWords, symbol: string, bounds: (state: S, sheet: ReserveSheet, words: ReserveWords, symbol: string) => BoundRow[]): HouseReading | null {
  return sheet === null || state === null ? null : { sheet, rows: bounds(state, sheet, words, symbol) };
}

/** web's `useHouseReserve`: all three hooks called, only the showing tab's enabled. */
function useHouseReserve(kind: HouseKind, words: ReserveWords, symbol: string): Reading<HouseReading | null> | null {
  const range = useRangeReserve(kind === "range");
  const parlay = useParlayReserve(kind === "parlay");
  const boost = useLeverageReserve(kind === "boost");
  if (kind === "range") return range && mapReading(range, (state) => house(state && rangeSheet(state), state, words, symbol, rangeBounds));
  if (kind === "parlay") return parlay && mapReading(parlay, (state) => house(state && parlaySheet(state), state, words, symbol, parlayBounds));
  return boost && mapReading(boost, (state) => house(state && boostSheet(state), state, words, symbol, boostBounds));
}

function useHouseShares(kind: HouseKind): Reading<ProviderShares> | null {
  const { address } = useWalletSession();
  const range = useRangeShares(kind === "range" ? address : null);
  const parlay = useParlayShares(kind === "parlay" ? address : null);
  const boost = useLeverageShares(kind === "boost" ? address : null);
  return kind === "range" ? range : kind === "parlay" ? parlay : boost;
}

/** web's `features/earn/HouseEarn.tsx`: range & moonshot, parlay and boost — the same hero and cards, the reserve's own bounds as §02. */
export function HouseEarn({ kind, symbol, tabs }: { kind: HouseKind; symbol: string; tabs: ReactNode }) {
  const words = RESERVES[kind];
  const reading = useHouseReserve(kind, words, symbol);
  const value = reading && isOk(reading) ? reading.value : null;
  const deployed = reading === null || value !== null;
  return (
    <>
      {deployed ? <EarnHero words={words} sheet={value?.sheet ?? null} symbol={symbol} /> : null}
      {tabs}
      <ReadingView reading={reading} loading="plate">
        {(state) => (state ? <Page kind={kind} words={words} reading={state} symbol={symbol} /> : <NotOnThisCluster blurb={words.blurb} why={EARN.notDeployed.reserve(words.label)} />)}
      </ReadingView>
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
  return (
    <EarnMain
      words={words}
      sheet={sheet}
      symbol={symbol}
      pausedBody={sheet.paused ? EARN.paused.reserveBody : null}
      connected={address !== null}
      walletBase={walletBase}
      held={held}
      busy={writes.busy}
      onSupply={writes.supply}
      onWithdraw={writes.withdraw}
      message={message}
      onMessage={setMessage}
      second={{ number: EARN.sections.windows.number, title: words.boundsTitle }}
    >
      <ReserveBounds rows={reading.rows} risk={words.risk} />
    </EarnMain>
  );
}
