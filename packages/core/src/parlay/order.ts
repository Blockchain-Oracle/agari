import type { ParlayLeg } from "./types";

/**
 * The one leg the reserve will decide next: the pending leg with the earliest boundary, lowest index first
 * (mirrors `ParlayTicket::next_leg` in `agari-parlay`). Legs are decided in the order their Windows close, not the
 * order somebody chooses to settle them in, so a ticket's fate is what the venue recorded and nothing else. `null`
 * once every leg has an answer.
 */
export function nextParlayLegIdx(legs: readonly Pick<ParlayLeg, "status" | "expirySec">[]): number | null {
  let next: number | null = null;
  legs.forEach((leg, idx) => {
    if (leg.status !== "pending") return;
    const best = next === null ? null : legs[next];
    if (!best || leg.expirySec < best.expirySec) next = idx;
  });
  return next;
}
