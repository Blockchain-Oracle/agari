import { etMinutesOf } from "../market/et-time";
import { equityCurve, maxDrawdownBase, winStreaks, type EquityPoint } from "./equity";
import type { SettledRound } from "./types";

/** The four regular-session buckets a Window's close falls in (proof-analytics.md §2.2, Q-S5-6). */
export type EdgeWindowKey = "open" | "morning" | "midday" | "close";

export interface EdgeWindow {
  key: EdgeWindowKey;
  /** ET minutes after midnight: the bucket holds closes with `fromMin ≤ etMinutesOf(expirySec − 1) < toMin`. */
  fromMin: number;
  toMin: number;
  count: number;
  wins: number;
  netBase: bigint;
}

/** Which sentence the readout panel prints; the words live with the surface, the choice lives here. */
export type EdgeReadout =
  | { kind: "more-rounds"; needed: number }
  | { kind: "best-window"; window: EdgeWindow }
  | { kind: "profit-factor"; factor: number }
  | { kind: "drawdown"; drawdownBase: bigint }
  | { kind: "flat" };

export interface TraderEdge {
  settledRounds: number;
  openRounds: number;
  wins: number;
  losses: number;
  voids: number;
  netBase: bigint;
  stakeBase: bigint;
  settlementFeesBase: bigint;
  roiPct: number | null;
  winRatePct: number | null;
  profitFactor: number | null;
  expectancyBase: bigint | null;
  averageWinBase: bigint | null;
  averageLossBase: bigint | null;
  maxDrawdownBase: bigint;
  bestWinStreak: number;
  currentWinStreak: number;
  equity: EquityPoint[];
  windows: EdgeWindow[];
  bestWindow: EdgeWindow | null;
  readout: EdgeReadout;
}

/** 09:30, 10:30, 12:00, 15:00 and 16:00 ET in minutes. An early close (13:00) lands in `midday`. */
const WINDOW_DEFS: ReadonlyArray<Pick<EdgeWindow, "key" | "fromMin" | "toMin">> = [
  { key: "open", fromMin: 570, toMin: 630 },
  { key: "morning", fromMin: 630, toMin: 720 },
  { key: "midday", fromMin: 720, toMin: 900 },
  { key: "close", fromMin: 900, toMin: 960 },
];

/** Five settled rounds before a pattern is called one — the reference's own floor. */
const PATTERN_FLOOR = 5;
const PROFIT_FACTOR_WORTH_SAYING = 1.2;

/** Ratio of two base amounts as a float — presentation only, never fed back into money. */
function ratio(numerator: bigint, denominator: bigint): number {
  return Number((numerator * 1_000_000n) / denominator) / 1_000_000;
}

/**
 * The session bucket a round's Window closed in, keyed on its close boundary in ET; null outside the regular session
 * (S6's Gap and token lanes). The reference grouped by the browser-local hour of the settle time, but settlement lands
 * seconds to minutes after the boundary and would move a 16:00 close out of the session. One second before the
 * boundary puts a 10:30:00 close in the hour it ends.
 */
export function etSessionBucket(round: Pick<SettledRound, "expirySec">): EdgeWindowKey | null {
  const minutes = etMinutesOf(round.expirySec - 1);
  return WINDOW_DEFS.find((def) => minutes >= def.fromMin && minutes < def.toMin)?.key ?? null;
}

function readoutOf(settled: number, best: EdgeWindow | null, grossProfit: bigint, grossLoss: bigint, net: bigint, drawdown: bigint): EdgeReadout {
  if (settled < PATTERN_FLOOR) return { kind: "more-rounds", needed: PATTERN_FLOOR - settled };
  if (best && best.count >= 2 && best.netBase > 0n) return { kind: "best-window", window: best };
  if (grossLoss > 0n && ratio(grossProfit, grossLoss) >= PROFIT_FACTOR_WORTH_SAYING) return { kind: "profit-factor", factor: ratio(grossProfit, grossLoss) };
  if (net < 0n && drawdown > 0n) return { kind: "drawdown", drawdownBase: drawdown };
  return { kind: "flat" };
}

/**
 * An honest report over settled rounds: what pays, what costs, and when. Ported from the
 * reference's `computeTraderEdge729`; money stays in base units, only ratios become floats.
 * `bucketOf` is injectable so a test can place rounds without building ET instants.
 */
export function computeTraderEdge(rounds: readonly SettledRound[], openRounds: number, bucketOf: (round: SettledRound) => EdgeWindowKey | null = etSessionBucket): TraderEdge {
  const wins = rounds.filter((round) => round.outcome === "win");
  const losses = rounds.filter((round) => round.outcome === "loss");
  const voids = rounds.filter((round) => round.outcome === "void");
  const netBase = rounds.reduce((sum, round) => sum + round.pnlBase, 0n);
  const stakeBase = rounds.reduce((sum, round) => sum + round.stakeBase, 0n);
  const settlementFeesBase = rounds.reduce((sum, round) => sum + round.feeBase, 0n);
  const grossProfit = rounds.filter((round) => round.pnlBase > 0n).reduce((sum, round) => sum + round.pnlBase, 0n);
  const grossLoss = -rounds.filter((round) => round.pnlBase < 0n).reduce((sum, round) => sum + round.pnlBase, 0n);
  const equity = equityCurve(rounds);
  const drawdown = maxDrawdownBase(equity);
  const streaks = winStreaks(rounds);

  const buckets = rounds.map((round) => bucketOf(round));
  const windows: EdgeWindow[] = WINDOW_DEFS.map((def) => {
    const inWindow = rounds.filter((_, i) => buckets[i] === def.key);
    return { ...def, count: inWindow.length, wins: inWindow.filter((round) => round.outcome === "win").length, netBase: inWindow.reduce((sum, round) => sum + round.pnlBase, 0n) };
  });
  const populated = windows.filter((window) => window.count > 0);
  const bestWindow = populated.length > 0 ? [...populated].sort((a, b) => (b.netBase > a.netBase ? 1 : b.netBase < a.netBase ? -1 : b.count - a.count))[0]! : null;
  const decided = wins.length + losses.length;

  return {
    settledRounds: rounds.length,
    openRounds,
    wins: wins.length,
    losses: losses.length,
    voids: voids.length,
    netBase,
    stakeBase,
    settlementFeesBase,
    roiPct: stakeBase > 0n ? ratio(netBase, stakeBase) * 100 : null,
    winRatePct: decided > 0 ? (wins.length / decided) * 100 : null,
    profitFactor: grossLoss > 0n ? ratio(grossProfit, grossLoss) : null,
    expectancyBase: rounds.length > 0 ? netBase / BigInt(rounds.length) : null,
    averageWinBase: grossProfit > 0n ? grossProfit / BigInt(rounds.filter((round) => round.pnlBase > 0n).length) : null,
    averageLossBase: grossLoss > 0n ? grossLoss / BigInt(rounds.filter((round) => round.pnlBase < 0n).length) : null,
    maxDrawdownBase: drawdown,
    bestWinStreak: streaks.best,
    currentWinStreak: streaks.current,
    equity,
    windows,
    bestWindow,
    readout: readoutOf(rounds.length, bestWindow, grossProfit, grossLoss, netBase, drawdown),
  };
}
