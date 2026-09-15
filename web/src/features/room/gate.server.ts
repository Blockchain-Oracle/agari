import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isAddress, isSignature, type Address, type MarketId } from "@agari/core/types";
import { hasBet, hasBetOnSymbol, hasIndexedBet, hasIndexedBetOnSymbol, indexedWindowState } from "@agari/db";
import { ensureMarkets, marketsProvider, parseMarketsEnv } from "@agari/markets";
import { verifyWalletMessage } from "@/lib/auth/verify-signed-message.server";
import { ROOM_TOKEN_TTL_MS, roomJoinMessage } from "./protocol";
import { parseRoomId, type RoomId } from "./room-id";

/**
 * The Room's authority — server only. Nothing here may be imported by a component.
 *
 * Two facts have to be true before a wallet may read or post, and both are checked
 * here rather than in the browser: it owns the address it claims (a signature), and
 * it has bet on this Room's Window or ticker (the registry, the index or the chain).
 * A gate that lives only in the UI is not a gate — the sheet says "bettors only", so
 * the server has to mean it.
 */

/**
 * The key that signs session tokens.
 *
 * `ROOM_TOKEN_SECRET` keeps sessions valid across restarts and across instances; a
 * per-process random key is the fallback, which is correct but means a redeploy or
 * a dev reload asks the wallet to sign again. That is a nuisance, never a hole.
 */
const SECRET = process.env.ROOM_TOKEN_SECRET ?? randomBytes(32).toString("hex");

/** What a token admits to: one Room, or the social session that records follows (lane 13d). */
export type TokenScope = RoomId | "social";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** `<address>.<scope>.<expiry>.<mac>` — the claim travels with its own signature. No scope contains a dot. */
export function mintToken(address: string, scope: TokenScope, nowMs: number): string {
  // The address goes in exactly as written: base58 is case-sensitive (D-010).
  const payload = `${address}.${scope}.${nowMs + ROOM_TOKEN_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** The address this token proves for exactly this scope, or null. Constant-time compare, so a MAC cannot be probed byte by byte. */
export function readToken(token: string, scope: TokenScope, nowMs: number): string | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [address, tokenScope, expiry, mac] = parts as [string, string, string, string];
  if (tokenScope !== scope) return null;
  if (!/^\d+$/.test(expiry) || Number(expiry) <= nowMs) return null;

  const expected = Buffer.from(sign(`${address}.${tokenScope}.${expiry}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return address;
}

/** Whether the signature really is this address's, over the message we would have asked for (ed25519, D-012). */
export async function verifyJoinSignature(roomId: RoomId, address: string, issuedAtMs: number, signature: string): Promise<boolean> {
  if (!isAddress(address) || !isSignature(signature)) return false;
  return verifyWalletMessage({ text: roomJoinMessage(roomId, address, issuedAtMs), signature, signer: address });
}

/** The gate step that said yes, for the join log. */
export type RoomGateStep = "registry" | "index" | "seat";

/** A source could not be read and none said yes: the answer is "try again", never "no position". */
export class GateUnreadableError extends Error {
  constructor(readonly step: RoomGateStep) {
    super(`room gate unreadable at ${step}`);
  }
}

/**
 * The chain seat, for a fill still inside the indexer's lag. A Window the index already holds as past (settled, or
 * expired a minute ago) answers no without a read, so only a live or brand-new Window costs RPC (≤ 2 calls: the
 * Market with the cached venue, then the Ledger seat).
 */
async function seatHolds(address: string, marketId: MarketId): Promise<boolean> {
  const window = await indexedWindowState(marketId, Math.floor(Date.now() / 1000));
  if (window === "past") return false;
  const env = parseMarketsEnv();
  ensureMarkets(env);
  const onchain = await marketsProvider.getOnchain(marketId);
  if (!onchain.ok) {
    if (onchain.error.kind === "market-not-trading") return false;
    throw new Error(onchain.error.kind);
  }
  const holdings = await marketsProvider.getHoldings(address as Address, onchain.value);
  if (!holdings.ok) throw new Error(holdings.error.kind);
  return holdings.value.upRaw > 0n || holdings.value.downRaw > 0n;
}

/**
 * Which step admits this wallet to this Room, or null (social-assistant.md §1.2). The checks run in order and the
 * first yes admits:
 *
 *   1. registry  the `bettors` row `/api/room/bet` wrote after reading the fill from the index
 *   2. index     "ever bet": a fill or a mint on the Window (a ticker Room: on any Window of that ticker)
 *   3. seat      the Ledger seat on chain, for a fill the indexer has not caught yet (Window Rooms only)
 *
 * The reference's rule is `bet_registry::has_bet` — ever bet, not "holds now" — so selling out or a settled Window
 * never locks a bettor out of their own Room. Throws `GateUnreadableError` when a step failed and none said yes.
 */
export async function admittingStep(address: string, roomId: RoomId): Promise<RoomGateStep | null> {
  const room = parseRoomId(roomId);
  if (!room) return null;
  const { chainId } = parseMarketsEnv();
  const steps: [RoomGateStep, () => Promise<boolean | null>][] =
    room.kind === "window"
      ? [
          ["registry", () => hasBet(chainId, room.marketId, address)],
          ["index", () => hasIndexedBet(room.marketId, address)],
          ["seat", () => seatHolds(address, room.marketId)],
        ]
      : [
          ["registry", () => hasBetOnSymbol(chainId, room.symbol, address)],
          ["index", () => hasIndexedBetOnSymbol(room.symbol, address)],
        ];
  let unreadable: RoomGateStep | null = null;
  for (const [step, check] of steps) {
    try {
      const answer = await check();
      if (answer === true) return step;
      if (answer === null) unreadable ??= step;
    } catch {
      unreadable ??= step;
    }
  }
  if (unreadable) throw new GateUnreadableError(unreadable);
  return null;
}

/** Has this wallet bet on this Room's Window (or ticker)? Throws `GateUnreadableError` rather than guess. */
export async function holdsPosition(address: string, roomId: RoomId): Promise<boolean> {
  return (await admittingStep(address, roomId)) !== null;
}
