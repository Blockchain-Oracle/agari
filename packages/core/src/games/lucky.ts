import { BASKET_SYMBOLS } from "../market/baskets";
import { LAUNCH_TICKERS } from "../market/tickers";
import type { MarketId, Side } from "../types/market";
import type { Hex } from "../types/primitives";
import { addressWord, concatWords, uintWord } from "./commitment";
import { INTERVAL_5M_SEC } from "./deck";

/**
 * Lucky, as pure data: the policy a draw is made under, the bytes a candidate set commits to, the rule
 * that turns a drawn reach into one live Window, and the streak a verified history adds up to.
 *
 * The honesty rule the whole mode hangs on (`04-game-system.md` §Mode truth): the seed and the real quote
 * are shown before anything is placed. The commitment proves the draw was not changed after the reels
 * moved; it does not prove the Window was chosen fairly, which is why the candidate set is hashed too and
 * why the policy version rides in the HMAC message — a draw made under one set of rules can never claim
 * another's guarantees (`06-game-architecture.md` §/games/lucky).
 */

/**
 * The policies a draw can be sealed under. The asset list is part of each one — the draw is an index into it, so a
 * verifier replays the same list — and a name is only ever added under a new version.
 *
 * - **2** (2026-09-19, retired for new draws): the nine launch tickers' Regular lanes, then OPENAI's 24/7 lane.
 * - **3** (S23, 2026-09-23): while any stock Window trades — the launch tickers, then every 24/7 lane the venue
 *   registered (OPENAI's and the five baskets').
 * - **4** (S23): while no stock Window trades — the 24/7 lanes alone, so a spin out of hours never draws a stock
 *   with nothing to deal. Before S23 the closed-market spin drew a stock nine times in ten and dealt nothing.
 *
 * The server picks 3 or 4 from what the venue is trading when the seed is sealed (`luckyPolicyFor`); the version
 * rides in the HMAC message and the proof, so a draw can never claim the other list.
 */
export const LUCKY_POLICY_V2 = 2;
export const LUCKY_POLICY_VERSION = 3;
export const LUCKY_ALLDAY_POLICY_VERSION = 4;
export const LUCKY_ASSETS_V2: readonly string[] = [...LAUNCH_TICKERS, "OPENAI"];
/** The 24/7 lanes the venue registered (`init-*-series`): OPENAI-60m and the five basket lanes. Appended only. */
export const LUCKY_ALLDAY_ASSETS: readonly string[] = ["OPENAI", ...BASKET_SYMBOLS];
export const LUCKY_ASSETS: readonly string[] = [...LAUNCH_TICKERS, ...LUCKY_ALLDAY_ASSETS];

/** The list a verifier must replay a draw against, or null for a version this build does not know. */
export function luckyPolicyAssets(policyVersion: number): readonly string[] | null {
  if (policyVersion === LUCKY_POLICY_VERSION) return LUCKY_ASSETS;
  if (policyVersion === LUCKY_ALLDAY_POLICY_VERSION) return LUCKY_ALLDAY_ASSETS;
  if (policyVersion === LUCKY_POLICY_V2) return LUCKY_ASSETS_V2;
  return null;
}

/** The policy a new seed is sealed under: the full list while stock Windows trade, the 24/7 lanes otherwise. */
export const luckyPolicyFor = (stocksTrading: boolean): number => (stocksTrading ? LUCKY_POLICY_VERSION : LUCKY_ALLDAY_POLICY_VERSION);
/** Versions a new reveal may still be dealt under (2 is kept only so old draws verify). */
export const isLiveLuckyPolicy = (policyVersion: number): boolean => policyVersion === LUCKY_POLICY_VERSION || policyVersion === LUCKY_ALLDAY_POLICY_VERSION;
export const LUCKY_MULTIPLIERS: readonly number[] = [2, 3, 5, 10, 25];
/** Headroom for a human signature between the deal and the fill. */
export const LUCKY_MIN_HEADROOM_SEC = 120;
/** Excluded by the deck policy's own rule: 5m returns only with a measured end-to-end timing. */
export const LUCKY_EXCLUDED_INTERVAL_SEC = INTERVAL_5M_SEC;
/** Past this the live multiple has moved far enough from the dealt one that the card must say so. */
export const LUCKY_DRIFT_BPS = 1_000;

const BPS = 10_000;

/**
 * The exact bytes hashed into a candidate-set commitment: the policy version, the count, and the market ids
 * sorted by their 32 decoded bytes — so the same set in any order commits to the same hash, and no two different
 * sets to one. Base58 text is never lowercased or text-sorted: it is case-sensitive and varies in length.
 */
export function luckyCandidatePreimage(marketIds: readonly MarketId[], policyVersion: number): Hex {
  const words = [...new Set(marketIds)].map(addressWord).sort();
  return concatWords([uintWord(BigInt(policyVersion)), uintWord(BigInt(words.length)), ...words]);
}

/** A live Window as the eligibility scan sees it. */
export interface LuckyCandidate {
  marketId: MarketId;
  asset: string;
  intervalSec: number;
  expirySec: number;
  /** The venue's own trading status, already normalised by the market port. */
  trading: boolean;
}

export interface LuckyEligibility {
  minHeadroomSec?: number;
  excludedIntervalSec?: number;
}

/** The Windows a drawn asset may be placed on: trading now, with real life left, and not on the excluded cadence. */
export function eligibleLuckyWindows(candidates: readonly LuckyCandidate[], asset: string, nowSec: number, options: LuckyEligibility = {}): LuckyCandidate[] {
  const headroom = options.minHeadroomSec ?? LUCKY_MIN_HEADROOM_SEC;
  const excluded = options.excludedIntervalSec ?? LUCKY_EXCLUDED_INTERVAL_SEC;
  return candidates
    .filter((c) => c.asset === asset && c.trading && c.intervalSec !== excluded && c.expirySec - nowSec >= headroom)
    .sort((a, b) => a.expirySec - b.expirySec);
}

/** A candidate with the drawn side's quote at the stake. A Window the book cannot fill at all never reaches this list. */
export interface LuckyQuoted {
  marketId: MarketId;
  expirySec: number;
  avgPriceBps: number;
  partial: boolean;
}

/** The price, in basis points of a whole unit, at which a contract pays the target multiple. */
export function targetPriceBps(multiplier: number): number {
  if (!(multiplier > 1)) throw new Error(`a reach must be above 1×, got ${multiplier}`);
  return Math.round(BPS / multiplier);
}

/** The gross multiple a price implies, in hundredths (2.94× → 294), so no float reaches a screen. */
export function impliedMultipleHundredths(avgPriceBps: number): number {
  if (avgPriceBps <= 0) throw new Error("a multiple needs a positive price");
  return Math.round((BPS * 100) / avgPriceBps);
}

/**
 * The fillable, non-partial quote whose price sits closest to `1 / M`; ties go to the soonest expiry, so a
 * player is never handed a longer wait than the reach needs.
 */
export function chooseLuckyWindow<T extends LuckyQuoted>(quotes: readonly T[], targetMultiplier: number): T | null {
  const target = targetPriceBps(targetMultiplier);
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const quote of quotes) {
    if (quote.partial) continue;
    const distance = Math.abs(quote.avgPriceBps - target);
    if (distance < bestDistance || (distance === bestDistance && best !== null && quote.expirySec < best.expirySec)) {
      best = quote;
      bestDistance = distance;
    }
  }
  return best;
}

/** True when the live price has moved more than `toleranceBps` of the dealt one — Pips' "unreachable, solved X×". */
export function luckyDrifted(dealtBps: number, liveBps: number, toleranceBps = LUCKY_DRIFT_BPS): boolean {
  return Math.abs(liveBps - dealtBps) * BPS > dealtBps * toleranceBps;
}

/**
 * Where a draw is. `drawn` is dealt and unplaced; `placed` is signed but not yet found on the tape; `pending`
 * is a measured fill waiting on its Window; the four after it are what the chain decided, or what the wallet
 * did on the book before it could. `refused` is a real row: a thin venue, a declined signature or a fill
 * that crossed nothing all leave one. `unknown` is a send with no verdict yet — never guessed either way.
 */
export type LuckyResult = "drawn" | "placed" | "pending" | "won" | "lost" | "void" | "cashed-out" | "refused" | "unknown";

export const LUCKY_RESULTS: readonly LuckyResult[] = ["drawn", "placed", "pending", "won", "lost", "void", "cashed-out", "refused", "unknown"];

/** The results a settlement read decided — the only rows a streak or a board may count. */
export const LUCKY_VERIFIED: ReadonlySet<LuckyResult> = new Set<LuckyResult>(["won", "lost", "void"]);

export function isLuckyTerminal(result: LuckyResult): boolean {
  return result === "won" || result === "lost" || result === "void" || result === "cashed-out" || result === "refused";
}

/** The chain's verdict on a held side. A voided Window pays both sides their half and decides nothing. */
export function luckyVerdict(side: Side, winningOutcome: 0 | 1 | null, voided: boolean): Extract<LuckyResult, "won" | "lost" | "void"> {
  if (voided || winningOutcome === null) return "void";
  return (side === "up" ? 0 : 1) === winningOutcome ? "won" : "lost";
}

/**
 * Consecutive wins from the newest verified row. A loss ends it; a void decided nothing and is skipped, as
 * is every row the chain has not settled — a pending spin is not a streak-breaker any more than a streak.
 */
export function luckyStreak(rows: readonly { result: LuckyResult }[]): number {
  let streak = 0;
  for (const row of rows) {
    if (!LUCKY_VERIFIED.has(row.result) || row.result === "void") continue;
    if (row.result === "lost") break;
    streak += 1;
  }
  return streak;
}

/** The longest run of wins anywhere in the history, by the same rule, over rows in any order of age. */
export function luckyBestStreak(rows: readonly { result: LuckyResult }[]): number {
  let best = 0;
  let run = 0;
  for (const row of rows) {
    if (!LUCKY_VERIFIED.has(row.result) || row.result === "void") continue;
    run = row.result === "won" ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}
