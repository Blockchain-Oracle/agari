/**
 * Marking the desk's own homework, a day later (desk.md §8, plan §5.8). It grades the TIMING CALL, never the money: a
 * decision is compared against the one alternative it really had, at the price each would have got. A buy the price
 * then rose past was still a good call if waiting would have cost more.
 *
 * Two rules keep it honest. A difference under 25 basis points is "no real difference", because that is inside the
 * cost of trading and calling it a win would be noise dressed as skill. And a decision the desk did not actually make,
 * or that never had an alternative, is "cannot be graded" rather than quietly counted as a win. Neutral both ways.
 */
import type { DeskSide } from "./needs";
import type { OutcomeColumn } from "./plan";

export const NO_REAL_DIFFERENCE_BPS = 25;
/** Graded once the alternative's price exists: a day after the decision. */
export const GRADE_AFTER_SEC = 86_400;

export type Verdict = "better" | "worse" | "no_real_difference" | "ungradable";

export interface Gradeable {
  outcome: OutcomeColumn | string;
  side: DeskSide | undefined;
  /** The price the desk would have paid or received at the moment it decided, 8 dp. */
  priceThenE8: bigint | undefined;
  /** The price a day later, from the same source, 8 dp. */
  priceLaterE8: bigint | undefined;
}

export interface Grade {
  verdict: Verdict;
  /** Positive means the choice made was better than the alternative, by this much. Null when ungradable. */
  differenceBps: number | null;
  chosen: string;
  alternative: string;
  why: string;
  /** False for the owner's own override: shown, but left out of the desk's Timing sum. */
  countsForTiming: boolean;
}

/** What the desk chose, and the one alternative worth comparing it against. */
const COMPARISONS: Record<string, { chosen: string; alternative: string; acted: boolean; counts: boolean } | undefined> = {
  acted: { chosen: "acting then", alternative: "waiting a day", acted: true, counts: true },
  acted_in_part: { chosen: "acting in part then", alternative: "waiting a day", acted: true, counts: true },
  // The owner's own call. Graded so the owner can see how it went, and left out of the desk's Timing sum.
  acted_by_override: { chosen: "acting then, on your call", alternative: "waiting a day", acted: true, counts: false },
  would_have_acted: { chosen: "acting then (in practice)", alternative: "waiting a day", acted: true, counts: true },
  waited: { chosen: "waiting a day", alternative: "acting then", acted: false, counts: true },
  declined: { chosen: "not acting", alternative: "acting then", acted: false, counts: true },
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function gradeDecision(d: Gradeable): Grade {
  const comparison = COMPARISONS[d.outcome];
  if (!comparison) {
    return { verdict: "ungradable", differenceBps: null, chosen: d.outcome, alternative: "none", why: "There was no alternative to compare this against.", countsForTiming: false };
  }
  const { chosen, alternative, acted, counts } = comparison;
  if (!d.side || !d.priceThenE8 || !d.priceLaterE8 || d.priceThenE8 <= 0n || d.priceLaterE8 <= 0n) {
    return { verdict: "ungradable", differenceBps: null, chosen, alternative, why: "One of the two prices could not be read, so there is nothing honest to compare.", countsForTiming: false };
  }
  // What acting then was worth against acting a day later. A buy wants the lower price, a sell the higher.
  const then = d.priceThenE8;
  const later = d.priceLaterE8;
  const actingBps = d.side === "buy" ? Number(((later - then) * 10_000n) / later) : Number(((then - later) * 10_000n) / later);
  const differenceBps = acted ? actingBps : -actingBps;

  if (Math.abs(differenceBps) < NO_REAL_DIFFERENCE_BPS) {
    return { verdict: "no_real_difference", differenceBps, chosen, alternative, why: "The two came out within a quarter of a percent of each other, which is inside the cost of trading.", countsForTiming: counts };
  }
  const better = differenceBps > 0;
  return {
    verdict: better ? "better" : "worse",
    differenceBps,
    chosen,
    alternative,
    why: better ? `${capitalise(chosen)} came out better than ${alternative}.` : `${capitalise(alternative)} would have come out better.`,
    countsForTiming: counts,
  };
}

/** The plate's Timing line (plan §5.7): the sum of counted grades, in basis points, and how many were graded. */
export function timingSum(grades: readonly Grade[]): { bps: number; graded: number } {
  const counted = grades.filter((g) => g.countsForTiming && g.differenceBps !== null);
  return { bps: counted.reduce((sum, g) => sum + (g.differenceBps as number), 0), graded: counted.length };
}
