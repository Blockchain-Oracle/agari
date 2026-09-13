import {
  findOpponent,
  queueKey,
  roomRef,
  roomError,
  searchBand,
  stakeTier,
  type ClientMessage,
  type QueueEntry,
  type ServerMessage,
  type StakeTierId,
} from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import { deckSupply } from "./deckmaster";
import type { Address, Bytes32 } from "@masayume/core/types";
import { readRatings } from "@masayume/db";
import { getArenaState } from "@masayume/markets/games";
import { WebSocket } from "ws";
import type { RoomConnection } from "../game-room/hub";
import type { Matchmaker, RoomContext } from "../game-room/handlers";
import { createPendingCreations, type PendingMatch } from "./pending";
import { dealDeck, newMatchId, seedCommitment } from "./deckmaster";

/**
 * The queue, the pairing and the seed ceremony — process memory with a chain-backed conscience.
 *
 * Nothing here is durable on purpose. A restart empties the queue, and the correct behaviour is that
 * every queued player is simply not queued any more: nobody has paid anything, no commitment has been
 * published, and a client that reconnects sees an idle snapshot and can queue again. What a restart must
 * NOT lose is a deck that was committed, and that is why the deckmaster writes before it commits.
 *
 * The order of operations is the honest one, and it is worth stating because it is easy to shorten:
 *
 *   join → pair → both seeds revealed → deck dealt and made durable → commitment sent
 *
 * A commitment is the first thing either player can act on, so nothing is published until the seeds are
 * in and the reveal is safe. Neither player, and not the server, can choose a seed after seeing another.
 *
 * **A queue entry is the client's, and only the client's.** The room used to put a player back in the
 * queue itself when a pairing failed, which read as a kindness and was three bugs. It re-queued the
 * player whose socket was in the middle of closing, so a ghost with no browser behind it was paired,
 * failed the seed window fifteen seconds later, and was paired again on the same tick — a loop the live
 * opponent could not escape (measured in `ops.log`, 2026-09-04, four pairings in thirty seconds). It
 * re-queued with the seed commitment the player had *already revealed*, so the server knew the next
 * match's seed before the ceremony began. And it moved a client's queue state without telling it, which
 * is the desync the whole screen was built to avoid. Now a dissolve is announced and nothing more: the
 * browser decides whether to search again, with a fresh seed, and the room learns of it the usual way.
 */

/** How long a paired player has to reveal the seed they committed to before the pairing is dissolved. */
const SEED_WINDOW_MS = 15_000;
/**
 * How long a paired match waits for the venue to have dealable Windows.
 *
 * It needs one because Shannon's cadences lock together on aligned boundaries: for the last couple of
 * minutes of a cycle there is no deck to deal, and the honest answer to two players who have already
 * been matched is "the next Windows open shortly", not "the queue failed". Three minutes covers a 15m
 * boundary with room to spare; past that, something else is wrong and they should be told so.
 */
const DEAL_WINDOW_MS = 3 * 60_000;
/** How often a queued player is told where their search has got to. */
const QUEUE_TICK_MS = 3_000;

interface Waiting extends QueueEntry {
  connection: RoomConnection;
  key: string;
  tier: StakeTierId;
}

interface Pairing {
  matchId: Bytes32;
  players: [Waiting, Waiting];
  seeds: Map<string, Bytes32>;
  openedAtMs: number;
  /** Set when both seeds are in and the deckmaster started trying; null while the seeds are still owed. */
  dealingSinceMs: number | null;
  /** The sweeper retries every tick; a deal that is still in flight must not be started twice. */
  dealing: boolean;
  /**
   * Set the moment this pairing is dissolved.
   *
   * A deal can be in flight for minutes while it waits on the venue, and it holds its own reference to
   * the pairing. Without this flag a pairing killed at T+0 still committed its deck at T+29s and sent
   * `deck.committed` to a browser that had moved on — which is how one player ended up looking at "open
   * the match" for a match the other had never been told about.
   */
  cancelled: boolean;
  /** The supply reading the last hold was told about, so the lobby can count down rather than spin. */
  nextDeckInSec: number | null | undefined;
}

export function createMatchmaker(ctx: RoomContext): Matchmaker {
  const region = process.env.GAME_ROOM_REGION ?? "default";
  const queues = new Map<string, Waiting[]>();
  const pairings = new Map<string, Pairing>();
  /** Which pairing a connection is in, so a seed reveal needs no search. */
  const pairingOf = new Map<string, string>();
  const pending = createPendingCreations(ctx);

  function drop(connection: RoomConnection): void {
    for (const [key, waiting] of queues) {
      const next = waiting.filter((entry) => entry.connection !== connection);
      if (next.length === 0) queues.delete(key);
      else queues.set(key, next);
    }
  }

  function tell(waiting: Waiting, message: ServerMessage): void {
    ctx.hub.send(waiting.connection, message);
  }

  /**
   * The pairing is over, and both players are told so as a state change.
   *
   * `searchAgain` is the difference between "nobody's fault" and "this will happen again": a venue with no
   * Windows is the first, a seed that did not match its commitment is the second. Neither re-queues here —
   * see the header.
   */
  function dissolve(pairing: Pairing, why: string, searchAgain = true): void {
    if (pairing.cancelled) return;
    pairing.cancelled = true;
    pairings.delete(pairing.matchId);
    for (const player of pairing.players) {
      pairingOf.delete(player.connection.id);
      tell(player, { type: "match.dissolved", matchId: pairing.matchId, why, searchAgain });
    }
    ctx.log(`pairing ${pairing.matchId} dissolved: ${why}`);
  }

  /**
   * Both seeds are in: deal, persist, commit. The room is joined first so the commitment and everything
   * after it reaches both players through one path.
   */
  async function commit(pairing: Pairing): Promise<void> {
    if (pairing.dealing || pairing.cancelled) return;
    pairing.dealing = true;
    try {
      await deal(pairing);
    } finally {
      pairing.dealing = false;
    }
  }

  /** True when this pairing stopped mattering while an await was outstanding. */
  function gone(pairing: Pairing): boolean {
    return pairing.cancelled || pairings.get(pairing.matchId) !== pairing;
  }

  async function deal(pairing: Pairing): Promise<void> {
    const [creator, challenger] = pairing.players;
    const state = await getArenaState();
    if (gone(pairing)) return;
    if (!isOk(state) || !state.value) return dissolve(pairing, "the arena is unreadable right now");

    const seeds = pairing.players.map((player) => pairing.seeds.get(player.connection.id) as Bytes32);
    const dealt = await dealDeck({
      matchId: pairing.matchId,
      chainId: ctx.chainId,
      arena: ctx.arena,
      clientSeeds: seeds,
      params: state.value.params,
    }, ctx.log);
    // Checked after the await, not before it: dealing can take minutes, and a deck committed to a pairing
    // that no longer exists is worse than no deck at all.
    if (gone(pairing)) return;
    if (!dealt.ok) {
      if (!dealt.retry) return dissolve(pairing, dealt.why);
      // Held, not dissolved: the venue will have Windows again shortly, and the pair is already made.
      // The wait is reported as progress every tick rather than once as an error.
      pairing.nextDeckInSec = dealt.nextDeckInSec;
      return;
    }

    pairings.delete(pairing.matchId);
    for (const entry of pairing.players) pairingOf.delete(entry.connection.id);
    const commitment = { hash: dealt.deck.deckHash, size: dealt.deck.cards.length, policyVersion: dealt.deck.policyVersion };
    const players = { creator: creator.wallet, challenger: challenger.wallet };
    pending.hold({ matchId: pairing.matchId, players, mode: stakeTier(creator.tier).mode, tier: creator.tier, commitment });
    for (const player of pairing.players) tell(player, { type: "deck.committed", matchId: pairing.matchId, commitment });
    ctx.log(`${pairing.matchId}: ${creator.wallet} vs ${challenger.wallet} · ${dealt.deck.cards.length} cards from the ${dealt.deck.lane} lane`);
  }

  /**
   * A pair, held until both seeds arrive.
   *
   * `match.found` goes out now rather than after the deck, and the ordering is not cosmetic: a client
   * cannot reveal a seed for a match it has not been told about, so publishing the pairing first is what
   * lets the ceremony start at all. It promises an opponent, which is true, and nothing about cards,
   * which are not dealt yet.
   */
  function pair(a: Waiting, b: Waiting): void {
    queues.set(a.key, (queues.get(a.key) ?? []).filter((entry) => entry !== a && entry !== b));
    const matchId = newMatchId();
    // The player who has waited longest creates the match, so the wallet that has already been patient
    // is the one whose transaction opens it rather than the one who just arrived.
    const players: [Waiting, Waiting] = a.queuedAtMs <= b.queuedAtMs ? [a, b] : [b, a];
    const pairing: Pairing = {
      matchId,
      players,
      seeds: new Map(),
      openedAtMs: Date.now(),
      dealingSinceMs: null,
      dealing: false,
      cancelled: false,
      nextDeckInSec: undefined,
    };
    pairings.set(matchId, pairing);

    const ref = roomRef(ctx.chainId, ctx.arena, matchId);
    const roster = [players[0].wallet, players[1].wallet];
    for (const [index, player] of players.entries()) {
      pairingOf.set(player.connection.id, matchId);
      ctx.hub.join(player.connection, ref, roster);
      const other = players[index === 0 ? 1 : 0] as Waiting;
      tell(player, {
        type: "match.found",
        room: ref,
        players: { creator: players[0].wallet, challenger: players[1].wallet },
        mode: stakeTier(player.tier).mode,
        tier: player.tier,
        opponent: { wallet: other.wallet, rating: other.rating },
      });
    }
    ctx.log(`${matchId}: paired ${players[0].wallet} and ${players[1].wallet}, waiting on both seeds`);
  }

  /**
   * One pass over a queue, pairing whoever is now in band.
   *
   * This runs on the tick, not only on arrival, and that is the whole point of a widening band: two
   * players 300 apart are not compatible when the second one joins, and are compatible a minute later.
   * Pairing only on `queue.join` would leave `searchBand` describing something that never happened.
   *
   * Only a connection that is actually open may be paired. It cannot normally be otherwise — a close
   * drops the entry — but a queue that can pair a dead socket costs its opponent a whole seed window per
   * attempt, so the invariant is checked here rather than trusted.
   */
  function sweepQueue(key: string, nowMs: number): void {
    let waiting = queues.get(key) ?? [];
    const live = waiting.filter((entry) => entry.connection.socket.readyState === WebSocket.OPEN);
    if (live.length !== waiting.length) queues.set(key, live);
    for (const entry of [...live].sort((x, y) => x.queuedAtMs - y.queuedAtMs)) {
      waiting = queues.get(key) ?? [];
      if (!waiting.includes(entry)) continue;
      const opponent = findOpponent(entry, waiting, nowMs);
      if (opponent) pair(entry, opponent);
    }
  }

  /**
   * How far off the next dealable deck is, refreshed once a tick and shared by every queued player.
   *
   * Cached rather than computed per player: it is a property of the venue, not of a wallet, and asking
   * the indexer once per waiting player per tick would be a read amplification with no new information.
   */
  let nextDeckInSec: number | null = null;
  /** Debounce: when the last read STARTED. Separate from `supplyKnown` on purpose — see below. */
  let supplyAtMs = 0;
  /**
   * Whether a supply read has ever completed.
   *
   * Not derivable from `supplyAtMs`, which is stamped when a read *starts* so two ticks cannot both
   * fire one. Reading "known" off that timestamp reported `nextDeckInSec: null` — "no deck for the
   * foreseeable future" — during the seconds the very first read was still in flight.
   */
  let supplyKnown = false;

  /** Absent until the first read lands, then a number or a real null. The protocol's own distinction. */
  const supply = () => (supplyKnown ? { nextDeckInSec } : {});

  async function refreshSupply(nowMs: number): Promise<void> {
    if (supplyAtMs !== 0 && nowMs - supplyAtMs < QUEUE_TICK_MS) return;
    supplyAtMs = nowMs;
    const state = await getArenaState();
    if (!isOk(state) || !state.value) return;
    nextDeckInSec = await deckSupply(state.value.params);
    supplyKnown = true;
  }

  // Warm before anyone queues, so the common case is a real countdown rather than "not known yet".
  void refreshSupply(Date.now());

  /** What a paired-but-undealt player is waiting on, and until when. The lobby's countdown. */
  function reportDealing(pairing: Pairing, nowMs: number): void {
    const seedsIn = pairing.seeds.size;
    const givesUpAtMs = pairing.dealingSinceMs === null ? pairing.openedAtMs + SEED_WINDOW_MS : pairing.dealingSinceMs + DEAL_WINDOW_MS;
    const deck = pairing.nextDeckInSec === undefined ? supply() : { nextDeckInSec: pairing.nextDeckInSec };
    for (const player of pairing.players) {
      tell(player, { type: "match.dealing", matchId: pairing.matchId, seedsIn, givesUpAtMs, serverTimeMs: nowMs, ...deck });
    }
  }

  const sweeper = setInterval(() => {
    const nowMs = Date.now();
    for (const pairing of [...pairings.values()]) {
      if (pairing.dealingSinceMs === null) {
        if (nowMs - pairing.openedAtMs > SEED_WINDOW_MS) {
          dissolve(pairing, "the other player did not open their seed in time");
          continue;
        }
      } else if (nowMs - pairing.dealingSinceMs > DEAL_WINDOW_MS) {
        dissolve(pairing, "the venue opened no Windows this match could be dealt from");
        continue;
      } else {
        void commit(pairing);
      }
      reportDealing(pairing, nowMs);
    }
    void pending.sweep(nowMs);
    for (const key of [...queues.keys()]) sweepQueue(key, nowMs);
    if (queues.size > 0) void refreshSupply(nowMs);
    for (const [key, waiting] of queues) {
      for (const entry of waiting) {
        const waitedMs = nowMs - entry.queuedAtMs;
        tell(entry, { type: "queue.update", waitingCount: waiting.length, bandNow: searchBand(waitedMs), waitedMs, ...supply() });
      }
      if (waiting.length === 0) queues.delete(key);
    }
  }, QUEUE_TICK_MS);
  sweeper.unref();

  return {
    async join(connection, request) {
      if (pairingOf.has(connection.id)) {
        ctx.hub.send(connection, roomError("already-queued", "you are already being paired", "queue.join"));
        return;
      }
      drop(connection);

      const key = queueKey(request.mode, request.tier, region);
      const ratings = await readRatings([connection.wallet]);
      const entry: Waiting = {
        wallet: connection.wallet,
        rating: ratings.get(connection.wallet)?.rating ?? 1_000,
        queuedAtMs: Date.now(),
        connectionId: connection.id,
        clientSeedCommitment: request.clientSeedCommitment,
        connection,
        key,
        tier: request.tier,
      };

      const queue = (queues.get(key) ?? []).filter((waiting) => waiting.connection.socket.readyState === WebSocket.OPEN);
      const opponent = findOpponent(entry, queue, entry.queuedAtMs);
      if (opponent) {
        queues.set(key, queue);
        ctx.log(`${connection.wallet} queued at ${key} (rating ${entry.rating}); paired at once`);
        return pair(entry, opponent);
      }

      queues.set(key, [...queue, entry]);
      ctx.hub.send(connection, { type: "queue.update", waitingCount: queue.length + 1, bandNow: searchBand(0), waitedMs: 0, ...supply() });
      ctx.log(`${connection.wallet} queued at ${key} (rating ${entry.rating}); ${queue.length + 1} waiting`);
    },

    leave(connection) {
      drop(connection);
      const matchId = pairingOf.get(connection.id);
      const pairing = matchId ? pairings.get(matchId) : undefined;
      if (pairing) dissolve(pairing, "the other player left before the deck was dealt");
    },

    async revealSeed(connection, message) {
      const matchId = pairingOf.get(connection.id);
      const pairing = matchId ? pairings.get(matchId) : undefined;
      if (!pairing || pairing.matchId !== message.matchId.toLowerCase()) {
        ctx.hub.send(connection, roomError("unknown-match", "there is no pairing waiting on that seed", "seed.reveal"));
        return;
      }
      const player = pairing.players.find((entry) => entry.connection === connection);
      if (!player) return;
      if (seedCommitment(message.seed).toLowerCase() !== player.clientSeedCommitment.toLowerCase()) {
        // The one refusal that is a player's own doing: they queued under a different seed.
        dissolve(pairing, "a revealed seed did not match the commitment it was queued with", false);
        return;
      }
      pairing.seeds.set(connection.id, message.seed);
      if (pairing.seeds.size < 2) return;
      pairing.dealingSinceMs = Date.now();
      await commit(pairing);
    },

    pendingFor: (wallet: Address): PendingMatch | null => pending.forWallet(wallet),
    releasePending: (matchId: string) => pending.release(matchId),

    /** Live occupancy, with no wallet involved — see the room's `/occupancy`. */
    occupancy() {
      const rows = [...queues.entries()].map(([key, waiting]) => {
        const [mode = "free", tier = "free"] = key.split(":");
        return { key, mode, tier, waiting: waiting.filter((e) => e.connection.socket.readyState === WebSocket.OPEN).length };
      });
      return { queues: rows, pairing: pairings.size, ...supply() };
    },
  };
}

export type { ClientMessage };
