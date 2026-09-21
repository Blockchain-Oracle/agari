import type { LeverageMark } from "@agari/core/leverage";
import { FIXTURE_NOW_MS } from "../leverage/fixtures";

/**
 * The Short card renders the same `LeveragePosition` the boost row does, so `/dev/leverage`'s positions are
 * reused rather than copied. Only the marks the short surface distinguishes are added here: a position with
 * room, one inside 20% of its line, and one the book cannot take in full.
 */
const UNIT = 1_000_000n;

/** 32 contracts fronted 10, line 12: the mark can still fall 35% before anyone may close it. */
export const MARK_CLEAR: LeverageMark = { markBase: 18_559_999n, filledRaw: 32n * UNIT, lineBase: 12n * UNIT, knockable: false };
/** Inside `SHORT_CLOSE_BPS` of the line — a 14% fall reaches it. */
export const MARK_CLOSE: LeverageMark = { markBase: 13_999_999n, filledRaw: 32n * UNIT, lineBase: 12n * UNIT, knockable: false };
/** Sized for `LIVE_3X` (45.71 contracts, 19,998,592 fronted → line 23,998,310), or the card reads as unpriced instead. */
export const MARK_AT: LeverageMark = { markBase: 23_000_000n, filledRaw: 45_710_000n, lineBase: 23_998_310n, knockable: true };
/** The book takes only part of the position, so there is no honest mark and no exit (D-114). */
export const MARK_THIN: LeverageMark = { markBase: 4_000_000n, filledRaw: 9n * UNIT, lineBase: 12n * UNIT, knockable: false };

export { FIXTURE_NOW_MS };
