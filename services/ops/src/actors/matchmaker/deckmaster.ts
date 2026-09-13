import { randomBytes } from "node:crypto";
import { deckCommitmentPreimage, nextDealableSec, selectDeck, type ArenaParams, type DeckCandidate, type DeckCard, type DeckLane } from "@masayume/core/games";
import { phase } from "@masayume/core/lifecycle";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32, Hex, MarketId } from "@masayume/core/types";
import { putDeck } from "@masayume/db";
import { marketsProvider, parseMarketsEnv, resolveVenueId } from "@masayume/markets";
import { keccak256 } from "viem";
import { DECK_KEY_ENV, deckKey, journal, seal, type RevealMaterial } from "./seal";

/**
 * Dealing a deck, and making its reveal durable before anyone can be asked to pay for it.
 *
 * The order here is the whole point. Cards are chosen, the material is written to disk and to Postgres,
 * and only then is a commitment handed back for a player to put on chain. A commitment published before
 * its preimage is durable is a match that can only refund, and the player who paid for it will have been
 * told a duel was about to start.
 *
 * The policy version is in the commitment, so a deck dealt under one set of rules can never claim
 * another's guarantees — and it is bumped here, beside the rules it names.
 */

/**
 * Bumped whenever the selection rules change. Version 3 (2026-09-03) is the owner-approved floor of two
 * cards, every eligible Window taken rather than one cadence preferred, and headroom sized against the
 * arena's own deadlines instead of a guessed margin.
 */
/** 4 since 2026-09-04: the headroom holds the arena's card-life floor for the whole pick window (rule D). */
export const DECK_POLICY_VERSION = 4;

/** A duel should finish inside an hour: every card must settle within it, or the match outlives its players. */
const HORIZON_SEC = Number(process.env.GAME_DECK_HORIZON_SEC ?? 60 * 60);

/**
 * Time between dealing a deck and the creator's `createMatch` landing — human signing plus a block.
 *
 * It is a real term in the headroom budget, not a fudge: the arena's join and reveal windows are counted
 * from creation, so anything spent before creation is spent on top of them.
 */
const CREATE_LATENCY_SEC = Number(process.env.GAME_DECK_CREATE_LATENCY_SEC ?? 45);

export interface DealtDeck {
  cards: readonly DeckCard[];
  lane: DeckLane;
  deckHash: Bytes32;
  policyVersion: number;
}

/**
 * `retry` separates "the venue has nothing open this minute" from "this deployment cannot deal decks".
 *
 * Measured on Shannon on 2026-09-03: the 5m, 15m and 1h Windows roll on aligned boundaries and lock
 * together, so for the last couple of minutes of every cycle the only trading Windows are the 4h and 1d
 * pair — outside a duel's horizon, and a deck is briefly impossible. That is a wait, not a failure, and
 * two players who have already been paired should not be thrown out of the queue for it.
 */
export type DealOutcome = { ok: true; deck: DealtDeck } | { ok: false; why: string; retry: boolean; nextDeckInSec?: number | null };

const bytes32 = (): Bytes32 => `0x${randomBytes(32).toString("hex")}`;

/** A fresh match id. Random rather than derived: two players must not be able to predict one another's. */
export function newMatchId(): Bytes32 {
  return bytes32();
}

/** The commitment a client publishes when it queues, and what the deckmaster checks its reveal against. */
export function seedCommitment(seed: Bytes32): Bytes32 {
  return keccak256(seed);
}

/**
 * Every live Window of the venue, unfiltered.
 *
 * It deliberately does NOT drop the Windows that are too close to expiry to deal. `selectDeck` applies
 * `minHeadroomSec` itself, so pre-filtering here changed no deck — but it silently broke the countdown
 * beside it. `nextDealableSec` projects each series forward to its SUCCESSOR Window, and the series
 * whose successor makes the next deck is precisely the one about to expire. Filtering those out left the
 * projection with only the 4h and 1d series, whose successors never fall inside a duel's horizon, so
 * `deckSupply` returned null — "further out than the projection looked" — exactly during the dead zone
 * where the queue has a countdown to show. Found on 2026-09-03 by `spike:duel-full` landing in the gap.
 */
async function candidates(): Promise<readonly DeckCandidate[] | null> {
  const venue = await resolveVenueId(parseMarketsEnv().venueId);
  if (!isOk(venue) || !venue.value.venueId) return null;
  const lanes = await marketsProvider.listLiveLanes(venue.value.venueId);
  if (!isOk(lanes)) return null;
  const nowMs = marketsProvider.nowMs();
  return lanes.value.lanes
    .flatMap((lane) => lane.markets)
    .map((market) => ({
      marketId: market.marketId,
      asset: market.asset,
      intervalSec: market.intervalSec,
      expirySec: market.expirySec,
      trading: phase(market, nowMs) === "trading",
      // The book filters are open until a measured spread and depth exist for a card's own stake; the
      // per-card cap is small enough that the arena's own minQuantity guard is the binding protection.
      spreadRaw: 0n,
      depthRaw: 1n,
    }));
}

/**
 * Seconds until the venue can next supply a deck, 0 when it already can, or null when it is unreadable
 * or further out than the projection looks. The queue's countdown, and nothing else's.
 */
export async function deckSupply(params: DealInput["params"]): Promise<number | null> {
  const headroomSec = dealHeadroomSec(params);
  const pool = await candidates();
  if (!pool) return null;
  const nowSec = Math.floor(marketsProvider.nowMs() / 1_000);
  const policy = {
    supportedAssets: [...new Set(pool.map((c) => c.asset))],
    maxSpreadRaw: 2n ** 128n,
    minDepthRaw: 0n,
    horizonSec: HORIZON_SEC,
    minHeadroomSec: headroomSec,
  };
  if (selectDeck(pool, policy, nowSec).ok) return 0;
  return nextDealableSec(pool, policy, nowSec);
}

export interface DealInput {
  matchId: Bytes32;
  chainId: number;
  arena: Address;
  clientSeeds: readonly Bytes32[];
  /** The arena's own deadlines. Headroom is derived from all four, never from `minCardLifeSec` alone. */
  params: Pick<ArenaParams, "minCardLifeSec" | "joinWindowSec" | "revealWindowSec" | "pickWindowSec">;
}

/**
 * How much life a card must have when the deck is DEALT.
 *
 * The arena checks `minCardLifeSec` at **reveal**, and a reveal may legally land after the whole join
 * window and the whole reveal window have elapsed since creation. So a deck sized only to
 * `minCardLifeSec` can be dealt on a Window that is perfectly legal now and dead by the time anyone can
 * open it — `revealDeck` reverts, nobody can open the deck, and the match refunds at its reveal
 * deadline. That is a silent bug in the happy path, because two players who sign in seconds never see
 * it; it appears exactly when one of them is slow, which is what those windows exist for.
 *
 * And the pick window is counted too (rule D, context/54 §5; the owner's decision of 2026-09-04): the
 * arena's floor is checked again at every pick, so a card revealed at exactly the floor is `TooLate`
 * long before a slow player's clock runs out. Holding the floor for the whole pick window costs deck
 * supply — measured 89.2% → 84.2% dealable on the live venue — and buys a rule that is true for every
 * second a player is allowed to swipe.
 */
export function dealHeadroomSec(params: DealInput["params"]): number {
  return params.minCardLifeSec + params.joinWindowSec + params.revealWindowSec + params.pickWindowSec + CREATE_LATENCY_SEC;
}

/**
 * Deals a deck for one match: choose, seal, persist, commit.
 *
 * Every failure returns a reason rather than throwing, because the caller's answer to all of them is the
 * same and it is a product decision: tell both players the queue could not deal, and put them back.
 */
export async function dealDeck(input: DealInput, onWarning?: (why: string) => void): Promise<DealOutcome> {
  const key = deckKey();
  if (!key) return { ok: false, why: `no ${DECK_KEY_ENV}, so a deck's reveal could not be kept`, retry: false };

  const headroomSec = dealHeadroomSec(input.params);
  const pool = await candidates();
  if (!pool) return { ok: false, why: "the venue's live Windows are unreadable", retry: true };

  const nowSec = Math.floor(marketsProvider.nowMs() / 1_000);
  const policy = {
    supportedAssets: [...new Set(pool.map((c) => c.asset))],
    maxSpreadRaw: 2n ** 128n,
    minDepthRaw: 0n,
    horizonSec: HORIZON_SEC,
    minHeadroomSec: headroomSec,
  };
  const selection = selectDeck(pool, policy, nowSec);
  if (!selection.ok) {
    // The count of live Windows rides along: "0 of 3" from an empty venue and "0 of 3" from a venue whose
    // Windows are all locked are different operational problems, and the log has to tell them apart.
    const trading = pool.filter((c) => c.trading).length;
    const inSec = nextDealableSec(pool, policy, nowSec);
    return {
      ok: false,
      retry: true,
      nextDeckInSec: inSec,
      why: `only ${selection.refusal.eligible} of ${selection.refusal.needed} Windows qualify (${trading} trading of ${pool.length} live, horizon ${HORIZON_SEC}s, headroom ${headroomSec}s)${inSec === null ? "" : `; the next deck is dealable in ${inSec}s`}`,
    };
  }

  const cards: readonly MarketId[] = selection.cards.map((card) => card.marketId);
  const serverSeed = bytes32();
  const material: RevealMaterial = {
    matchId: input.matchId,
    serverSeed,
    clientSeeds: input.clientSeeds,
    cards,
    policyVersion: DECK_POLICY_VERSION,
  };
  const preimage = deckCommitmentPreimage({
    chainId: input.chainId,
    arena: input.arena,
    matchId: input.matchId,
    policyVersion: DECK_POLICY_VERSION,
    serverSeed,
    clientSeeds: input.clientSeeds,
    cards,
  });
  const deckHash = keccak256(preimage as Hex);
  const sealed = seal(material, key);

  try {
    // The journal is the durable record and is written first; a failure here refuses the deal outright,
    // because a commitment whose preimage is not on disk is a match that can only ever refund.
    journal(input.matchId, sealed);
  } catch (error) {
    return { ok: false, retry: false, why: `the deck's reveal could not be written: ${error instanceof Error ? error.message : String(error)}` };
  }

  try {
    await putDeck({
      matchId: input.matchId,
      chainId: input.chainId,
      arena: input.arena,
      policyVersion: DECK_POLICY_VERSION,
      lane: selection.lane,
      cards,
      sealed,
    });
  } catch (error) {
    // The row is the queryable copy, not the durable one. Losing it costs a query, not a match — the
    // settler reads the journal when the database cannot answer.
    onWarning?.(`${input.matchId}: the deck row was not written (${error instanceof Error ? error.message : String(error)}); the journal has it`);
  }

  return { ok: true, deck: { cards: selection.cards, lane: selection.lane, deckHash, policyVersion: DECK_POLICY_VERSION } };
}
