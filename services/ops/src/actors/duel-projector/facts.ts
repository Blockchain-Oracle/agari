import { arenaPickKey, stakeTier, stakeTierIdOf, type CardReceipt, type MatchFacts } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32 } from "@masayume/core/types";
import { getArenaMatch } from "@masayume/markets/games";

/**
 * What the projector has to know about a match beyond the event in front of it.
 *
 * Two facts do not travel on every log. A pick's *seat* — which the pick key needs — is only knowable
 * from the match's two addresses, and a settlement's *cost* is only on the pick that preceded it. A
 * process that has run since the match was created has both; one that started or restarted in the
 * middle has neither, and inventing them would put a wrong PnL on a screen.
 *
 * So this cache is chain-backed rather than memory-only: a miss reads the match, which returns the
 * addresses and every pick the arena has recorded, and the projector carries on. A restart therefore
 * costs one read per live match, not a wrong number.
 */

export interface MatchEntry {
  facts: MatchFacts;
  mode: "free" | "ranked";
  tier: "free" | "t1" | "t5" | "t10";
  potPerPlayerBase: bigint;
  /** Every pick seen, by `arenaPickKey`, so a settlement can be given the cost its pick measured. */
  picks: Map<string, CardReceipt>;
  settled: number;
}

export type MatchCache = Map<string, MatchEntry>;

export function createMatchCache(): MatchCache {
  return new Map();
}

/** The entry a `created` event can build with no chain read at all — the common path in a live process. */
export function seedFromCreation(
  cache: MatchCache,
  input: { matchId: Bytes32; creator: Address; tier: number; deckSize: number; potBase: bigint },
): MatchEntry {
  const tier = stakeTierIdOf(input.tier);
  const entry: MatchEntry = {
    facts: { creator: input.creator.toLowerCase() as Address, challenger: null, deckSize: input.deckSize },
    mode: stakeTier(tier).mode,
    tier,
    potPerPlayerBase: input.potBase,
    picks: new Map(),
    settled: 0,
  };
  cache.set(input.matchId.toLowerCase(), entry);
  return entry;
}

const ZERO = "0x0000000000000000000000000000000000000000";

/** The entry for a match, reading the arena when this process has not seen it. Null when the arena has not either. */
export async function entryFor(cache: MatchCache, matchId: Bytes32, chainId: number): Promise<MatchEntry | null> {
  const key = matchId.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const reading = await getArenaMatch(matchId);
  if (!isOk(reading) || !reading.value) return null;
  const { match, picks } = reading.value;
  const tier = stakeTierIdOf(match.tier);
  const entry: MatchEntry = {
    facts: { creator: match.creator, challenger: match.challenger === ZERO ? null : match.challenger, deckSize: match.deckSize },
    mode: stakeTier(tier).mode,
    tier,
    potPerPlayerBase: match.potBase,
    picks: new Map(),
    settled: 0,
  };
  for (const pick of picks) {
    const player = pick.seat === 0 ? match.creator : match.challenger;
    entry.picks.set(arenaPickKey(chainId, match.matchId, pick.cardIndex, pick.seat), {
      cardIndex: pick.cardIndex,
      player,
      pick: pick.pick,
      quantity: pick.quantity,
      costBase: pick.costBase,
      payoutBase: pick.settled ? pick.payoutBase : null,
      pickKey: arenaPickKey(chainId, match.matchId, pick.cardIndex, pick.seat),
    });
    if (pick.settled) entry.settled += 1;
  }
  cache.set(key, entry);
  return entry;
}

/** Terminal matches are dropped: their story is told, and a projector that never forgets is a leak. */
export function forget(cache: MatchCache, matchId: Bytes32): void {
  cache.delete(matchId.toLowerCase());
}
