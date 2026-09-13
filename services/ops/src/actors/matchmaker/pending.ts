import { roomRef, stakeTier, type DeckCommitment, type DuelMode, type MatchPlayers, type ServerMessage, type StakeTierId } from "@masayume/core/games";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32 } from "@masayume/core/types";
import { getArenaMatch } from "@masayume/markets/games";
import type { RoomContext } from "../game-room/handlers";

/**
 * The gap between a sealed deck and a match on chain — the one part of a duel that exists nowhere else.
 *
 * A committed deck is real: it is hashed, written to Postgres and shown to both players. But until the
 * creator's `createMatch` lands, the arena has never heard of it, so the reconnect path — which asks the
 * chain projection what a wallet is in — answers "nothing", and a browser that reloaded in this window
 * lost a match it could see a second ago. That was the whole of "I refresh and it takes me back".
 *
 * So the room keeps it, and keeps it honestly:
 *
 * - **Process memory, deliberately.** The deck's reveal material is durable (`putDeck`); this is only the
 *   pairing around it, and a restart before creation costs two players a search, not a pot. Making it
 *   durable would mean writing a match the chain may never hold.
 * - **It expires against the arena, not against a clock.** Every sweep asks whether the match has appeared
 *   on chain: found, it is the projection's problem from now on and this forgets it. Not found by the
 *   deadline, both players are told the pairing is over rather than being left on a button whose
 *   transaction nobody is going to send — which is exactly where this session's two browsers stalled.
 */

/**
 * How long a sealed deck waits for its creator's transaction.
 *
 * It is the arena's own join window that this is really protecting: every second before creation is spent
 * on top of the deadlines counted from it, and the deck's headroom was budgeted with `CREATE_LATENCY_SEC`
 * in mind. Two minutes is a human reading a wallet prompt twice over, and short enough that a player who
 * walked away does not hold their opponent for the whole of the deck's life.
 */
const CREATE_WINDOW_MS = Number(process.env.GAME_CREATE_WINDOW_MS ?? 2 * 60_000);
/** A chain read per sweep per pending match would be wasteful at the queue's cadence; this is enough. */
const CHECK_EVERY_MS = 10_000;

export interface PendingMatch {
  matchId: Bytes32;
  players: MatchPlayers;
  mode: DuelMode;
  tier: StakeTierId;
  commitment: DeckCommitment;
  /** When the room stops waiting for `createMatch` and tells both players so. */
  givesUpAtMs: number;
}

interface Held extends PendingMatch {
  wallets: readonly Address[];
  checkedAtMs: number;
}

export interface PendingCreations {
  /** Records a sealed deck as awaiting its creator's transaction. */
  hold(input: { matchId: Bytes32; players: MatchPlayers; mode: DuelMode; tier: StakeTierId; commitment: DeckCommitment }): void;
  /** What this wallet is in before the chain knows — the reconnect path's pre-chain half. */
  forWallet(wallet: Address): PendingMatch | null;
  /** Forgets one, on any evidence the arena now holds it. */
  release(matchId: string): void;
  /** One pass: drop what the chain has taken over, end what nobody paid for. */
  sweep(nowMs: number): Promise<void>;
}

export function createPendingCreations(ctx: RoomContext): PendingCreations {
  const held = new Map<string, Held>();

  function tell(entry: Held, message: ServerMessage): void {
    for (const wallet of entry.wallets) ctx.hub.toWallet(wallet, message);
  }

  return {
    hold(input) {
      const wallets = [input.players.creator, input.players.challenger].filter((w): w is Address => Boolean(w));
      held.set(input.matchId.toLowerCase(), { ...input, wallets, givesUpAtMs: Date.now() + CREATE_WINDOW_MS, checkedAtMs: 0 });
    },

    forWallet(wallet) {
      const who = wallet.toLowerCase();
      for (const entry of held.values()) if (entry.wallets.some((w) => w.toLowerCase() === who)) return entry;
      return null;
    },

    release(matchId) {
      held.delete(matchId.toLowerCase());
    },

    async sweep(nowMs) {
      for (const [key, entry] of [...held]) {
        if (nowMs - entry.checkedAtMs < CHECK_EVERY_MS) continue;
        entry.checkedAtMs = nowMs;
        const reading = await getArenaMatch(entry.matchId);
        // Unreadable is not absent: an RPC blip must not end a match that may well be on chain.
        if (isOk(reading) && reading.value) {
          held.delete(key);
          ctx.log(`${entry.matchId}: on chain; the projection owns it now`);
          continue;
        }
        if (nowMs < entry.givesUpAtMs) continue;
        held.delete(key);
        tell(entry, {
          type: "match.dissolved",
          matchId: entry.matchId,
          why: `the deck was sealed but ${stakeTier(entry.tier).mode === "free" ? "nobody" : "neither player"} put the match on chain in time`,
          searchAgain: true,
        });
        ctx.log(`${entry.matchId}: never created on chain; both players released`);
      }
    },
  };
}

/** The room a pending match would broadcast into, so its two players share one before the chain does. */
export function pendingRef(ctx: RoomContext, matchId: Bytes32): ReturnType<typeof roomRef> {
  return roomRef(ctx.chainId, ctx.arena, matchId);
}
