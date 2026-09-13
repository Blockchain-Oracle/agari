import {
  applyResult,
  isVerifiedResult,
  messagesFor,
  receiptOfPick,
  receiptOfSettlement,
  roomKey,
  scoreForCreator,
  type ArenaEvent,
  type ArenaEventLog,
  type ProjectionContext,
} from "@masayume/core/games";
import type { Address } from "@masayume/core/types";
import { applyRatingsOnce, readRatings, recordMatchCreated, recordMatchProgress, recordPick, recordSettlement } from "@masayume/db";
import { resnapshotRoom, type RoomContext } from "../game-room/handlers";
import { entryFor, forget, seedFromCreation, type MatchCache, type MatchEntry } from "./facts";

/**
 * One arena event, applied: the row it writes and the message it sends.
 *
 * The order is deliberate — database first, then the room. A player who is told a card settled and then
 * reloads onto a projection that has not caught up would see the result move backwards, which reads as
 * the game losing their card. The other way round, the worst case is a message that arrives a beat late.
 */

export interface ApplyDeps {
  room: RoomContext | null;
  cache: MatchCache;
  chainId: number;
  arena: Address;
  log: (why: string) => void;
}

function broadcast(deps: ApplyDeps, matchId: string, entry: MatchEntry, event: ArenaEvent): void {
  if (!deps.room) return;
  const ctx: ProjectionContext = { chainId: deps.chainId, facts: entry.facts, picks: entry.picks, settled: entry.settled };
  const key = roomKey(deps.chainId, deps.arena, matchId);
  for (const message of messagesFor(event, ctx)) deps.room.hub.broadcast(key, message);
}

/**
 * The ladder, after a result the arena finalized.
 *
 * Free matches never move it (the owner's decision: only Ranked is rated), and neither does a match
 * that produced no settled card — a rating that punishes a dead Window is a rating nobody trusts. The
 * write is idempotent by match, so a re-read block cannot count a win twice.
 */
async function rate(deps: ApplyDeps, matchId: string, entry: MatchEntry, event: Extract<ArenaEvent, { kind: "finalized" }>): Promise<void> {
  const { creator, challenger } = entry.facts;
  if (entry.mode !== "ranked" || !challenger) return;
  if (!isVerifiedResult({ refunded: false, settledCards: entry.settled })) return;

  const records = await readRatings([creator, challenger]);
  const before = { a: records.get(creator), b: records.get(challenger) };
  if (!before.a || !before.b) return;

  const outcome = { winner: event.winner, pnlBase: { [creator]: event.creatorPnlBase, [challenger]: event.challengerPnlBase } };
  const score = scoreForCreator(outcome, creator);
  const after = applyResult(before.a, before.b, score);
  const moved = await applyRatingsOnce(matchId, [
    { wallet: creator, rating: after.a.rating, verifiedMatches: after.a.verifiedMatches, delta: after.a.rating - before.a.rating },
    { wallet: challenger, rating: after.b.rating, verifiedMatches: after.b.verifiedMatches, delta: after.b.rating - before.b.rating },
  ]);
  if (moved) deps.log(`${matchId}: ladder ${before.a.rating}→${after.a.rating} / ${before.b.rating}→${after.b.rating}`);
}

export async function applyEvent(deps: ApplyDeps, entry: ArenaEventLog): Promise<void> {
  const { event } = entry;
  if (event.kind === "claimed") return;

  const matchId = event.matchId.toLowerCase();
  const match =
    event.kind === "created"
      ? seedFromCreation(deps.cache, event)
      : await entryFor(deps.cache, event.matchId, deps.chainId);
  if (!match) return deps.log(`${matchId}: ${event.kind} for a match the arena does not have`);

  switch (event.kind) {
    case "created":
      await recordMatchCreated({
        matchId,
        chainId: deps.chainId,
        arena: deps.arena,
        mode: match.mode,
        tier: match.tier,
        creator: event.creator.toLowerCase(),
        challenger: null,
        status: "waiting",
        deckHash: event.deckHash,
        deckSize: event.deckSize,
        // `MatchCreated` does not carry it; the deck's reveal does, and fills it in below. Zero until then.
        policyVersion: 0,
        potPerPlayerBase: event.potBase.toString(),
      });
      return;

    case "joined":
      match.facts = { ...match.facts, challenger: event.challenger };
      await recordMatchProgress(matchId, { status: "activeUnrevealed", challenger: event.challenger });
      return;

    case "revealed":
      await recordMatchProgress(matchId, { status: "picking", cards: event.cards, policyVersion: event.policyVersion });
      // The one event a delta cannot carry: a card is a Window, and the log holds only its id.
      if (deps.room) await resnapshotRoom(deps.room, event.matchId);
      return;

    case "picked": {
      const ctx: ProjectionContext = { chainId: deps.chainId, facts: match.facts, picks: match.picks, settled: match.settled };
      const receipt = receiptOfPick(event, ctx);
      if (!receipt) return deps.log(`${matchId}: a pick from ${event.player}, who is not in this match`);
      match.picks.set(receipt.pickKey, receipt);
      await recordPick({
        pickKey: receipt.pickKey,
        matchId,
        cardIndex: event.cardIndex,
        player: receipt.player,
        marketId: event.marketId,
        side: event.pick,
        quantity: event.quantity.toString(),
        costBase: event.costBase.toString(),
        filledAtSec: entry.blockTimeSec,
      });
      broadcast(deps, matchId, match, event);
      return;
    }

    case "locked":
      await recordMatchProgress(matchId, { status: event.status === "forfeited" ? "forfeited" : "settling" });
      broadcast(deps, matchId, match, event);
      return;

    case "settled": {
      const ctx: ProjectionContext = { chainId: deps.chainId, facts: match.facts, picks: match.picks, settled: match.settled };
      // Null when the player is not in this match, or when the pick it settles was never seen — the
      // second is the one that matters, and core refuses to invent a cost rather than publish a PnL
      // that reads as pure profit.
      const receipt = receiptOfSettlement(event, ctx);
      if (!receipt) return deps.log(`${matchId}: card ${event.cardIndex} settled, but its pick is unknown to this projector`);
      // A replayed settlement must not count twice: only a card that was unpaid a moment ago is new.
      if (ctx.picks.get(receipt.pickKey)?.payoutBase === null) match.settled += 1;
      match.picks.set(receipt.pickKey, receipt);
      await recordSettlement(receipt.pickKey, event.payoutBase.toString());
      broadcast(deps, matchId, match, event);
      return;
    }

    case "finalized":
      await recordMatchProgress(matchId, {
        status: "finalized",
        winner: event.winner,
        creatorPnlBase: event.creatorPnlBase.toString(),
        challengerPnlBase: event.challengerPnlBase.toString(),
        finalized: true,
      });
      broadcast(deps, matchId, match, event);
      await rate(deps, matchId, match, event);
      forget(deps.cache, event.matchId);
      return;

    case "refunded":
      await recordMatchProgress(matchId, { status: "refunded", refundReason: event.reason });
      broadcast(deps, matchId, match, event);
      forget(deps.cache, event.matchId);
      return;
  }
}
