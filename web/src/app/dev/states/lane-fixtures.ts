/**
 * Canned Windows for the S6 lane states (session-lanes.md §5): the real 09-18 Gap at each of its phases, a weekend TSLAx
 * token Window, and the Regular Windows the ticket blockers and void claims are shown on. Prints are × 10⁻⁸.
 */
import { corporatePausedState, haltPausedState, voidDetail } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import type { GivenVoid } from "@/features/markets/claims/void-line";
import type { MarketCardData } from "@/features/markets/lanes/MarketCardView";
import { fixtureAddress, fixtureMarketId } from "../fixture-ids";
import { fixtureGapWindow, fixtureWindow, GAP_0918 } from "../fixture-window";
import { CLOCK } from "../session/market-session-fixtures";

const DECIMALS = 6;
const id = (n: number) => fixtureMarketId(0x56_0000 + n);

/** TSLA's Friday 09-11 close by Pyth (D-052) as the Gap's line, and a weekend drift under it. */
const TSLA_FRIDAY = 36_547_600_000n;
const TSLA_WEEKEND = 35_981_147_000n;
const NVDA_OPEN = 21_128_480_000n;

/** A gently falling spark ending at `latest`, one point a minute. */
function spark(startSec: number, fromRaw: bigint, toRaw: bigint, n = 24): MarketCardData["points"] {
  return Array.from({ length: n }, (_, i) => ({ timeSec: startSec + i * 60, valueRaw: fromRaw + ((toRaw - fromRaw) * BigInt(i)) / BigInt(n - 1) }));
}

const data = (points: MarketCardData["points"], upCents: number | null, downCents: number | null): MarketCardData => ({
  points,
  latestRaw: points.at(-1)?.valueRaw ?? null,
  upCents,
  downCents,
  hydrating: false,
});

export interface CardFixture {
  label: string;
  market: EventMarket;
  nowMs: number;
  data: MarketCardData;
}

const gap = (n: number, over: Partial<EventMarket> = {}) =>
  fixtureGapWindow({ marketId: id(n), decimals: DECIMALS, openingPriceRaw: TSLA_FRIDAY, status: "Trading", ...over });

export const GAP_CARDS: readonly CardFixture[] = [
  { label: "Gap · listed — calls open Fri 16:00 ET", market: gap(1, { status: "Listed", openingPriceRaw: null }), nowMs: CLOCK.listedWed * 1000, data: data([], null, null) },
  {
    label: "Gap · trading — asks about the Monday open, names its Sunday lock",
    market: gap(2),
    nowMs: CLOCK.weekendSat * 1000,
    data: data(spark(CLOCK.weekendSat - 1_440, TSLA_FRIDAY, TSLA_WEEKEND), 41, 61),
  },
  { label: "Gap · locked — settles Mon 09:30:00 ET", market: gap(3, { status: "Locked" }), nowMs: CLOCK.lockedMon * 1000, data: data(spark(CLOCK.lockedMon - 1_440, TSLA_FRIDAY, TSLA_WEEKEND), null, null) },
  {
    label: "Gap · settled — DOWN on the 09-21 print",
    market: gap(4, { status: "Resolved", winningOutcome: 1, resolvedAtMs: (GAP_0918.expirySec + 9) * 1000 }),
    nowMs: CLOCK.settledMon * 1000,
    data: data(spark(CLOCK.settledMon - 1_440, TSLA_FRIDAY, TSLA_WEEKEND), null, null),
  },
];

export const TOKEN_WINDOW = fixtureWindow({
  marketId: id(10),
  asset: "NVDA",
  lane: "token",
  intervalSec: 300,
  expirySec: 1_789_830_300,
  decimals: DECIMALS,
  printSource: "switchboard",
  openingPriceRaw: NVDA_OPEN,
});

export const TOKEN_CARD: CardFixture = {
  label: "Token · trading 24/7 — names the xStock",
  market: TOKEN_WINDOW,
  nowMs: CLOCK.weekendSat * 1000,
  data: data(spark(CLOCK.weekendSat - 1_440, NVDA_OPEN, NVDA_OPEN + 12_000_000n), 55, 47),
};

/** The roller's paused lanes, each with the state string ops sends. */
export const PAUSED_CARDS = [
  { label: "Paused — no signed source (QQQ Gap, 09-25)", asset: "QQQ", basis: "gap", intervalSec: 604_800, state: "paused: no signed source" },
  { label: "Paused — corporate action (NVDA split)", asset: "NVDA", basis: "regular", intervalSec: 300, state: corporatePausedState("4-for-1 split") },
  { label: "Paused — halted, pyth-wide (Trading halted)", asset: "TSLA", basis: "regular", intervalSec: 300, state: haltPausedState({ reason: "pyth-wide", sinceSec: 0 }) },
  { label: "Paused — halted, redstone-stale (Signed price stale)", asset: "AAPL", basis: "regular", intervalSec: 900, state: haltPausedState({ reason: "redstone-stale", sinceSec: 0 }) },
] as const;

/** Windows the ticket blockers read: a Regular Window in session, before the open, and a Gap before its calls. */
export const REGULAR_TRADING = fixtureWindow({ marketId: id(20), intervalSec: 300, expirySec: CLOCK.regularTue + 180, decimals: DECIMALS, openingPriceRaw: TSLA_WEEKEND });
export const REGULAR_UPCOMING = fixtureWindow({ marketId: id(21), intervalSec: 300, expirySec: CLOCK.preTue + 5_700, decimals: DECIMALS, status: "Listed" });
export const REGULAR_SETTLED = fixtureWindow({ marketId: id(22), intervalSec: 3_600, expirySec: CLOCK.postTue - 3_600, decimals: DECIMALS, status: "Resolved", winningOutcome: 0, openingPriceRaw: TSLA_WEEKEND });
export const PAUSED_UPCOMING = fixtureWindow({ marketId: id(23), asset: "NVDA", intervalSec: 300, expirySec: CLOCK.regularTue + 300, decimals: DECIMALS, status: "Listed" });
export const GAP_LISTED = GAP_CARDS[0]!.market;

/** Each void reason as the claim card and row name it, decided by core `voidDetail` from a Window's prints. */
const tue = { tradingStartSec: 1_789_501_500, lockAtSec: 1_789_502_400, expirySec: 1_789_502_400 }; // 15:45–16:00 ET
export const VOID_FIXTURES: ReadonlyArray<{ label: string; given: GivenVoid }> = [
  {
    label: "missing print — the 16:00 Pyth close never landed",
    given: { detail: voidDetail({ voidReason: "missing-print", lane: "regular", primarySource: "pyth", ...tue, openE8: TSLA_WEEKEND, closeE8: null }) },
  },
  {
    label: "missing print — a Gap's Friday RedStone open, admissible until the lock",
    given: { detail: voidDetail({ voidReason: "missing-print", lane: "gap", primarySource: "redstone", ...GAP_0918, openE8: null, closeE8: null }) },
  },
  {
    label: "cross-check divergence — Pyth vs RedStone past 0.25%",
    given: {
      detail: voidDetail({ voidReason: "cross-check-divergence", lane: "regular", primarySource: "pyth", checkSource: "redstone", ...tue, openE8: TSLA_WEEKEND, closeE8: 35_990_000_000n, checkOpenE8: TSLA_WEEKEND, checkCloseE8: 35_870_000_000n }),
      checkSource: "redstone",
    },
  },
];

export const VOID_SEAT = fixtureAddress("0x5ea7");
