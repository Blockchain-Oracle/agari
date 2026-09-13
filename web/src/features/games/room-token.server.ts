import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  canRenewRoomToken,
  mintRoomToken,
  parseRoomToken,
  renewRoomTokenClaims,
  roomAuthFresh,
  roomAuthMessage,
  roomSessionClaims,
  roomTokenExpiresAtMs,
  verifyRoomToken,
  type RoomTokenClaims,
} from "@masayume/core/games";
import type { Address } from "@masayume/core/types";
import { parseMarketsEnv } from "@masayume/markets";
import { resolveArenaDeployment } from "@masayume/markets/games";
import { verifyMessage } from "viem";

/**
 * Minting the duel room's credential — server only. Nothing here may be imported by a component.
 *
 * The browser's game key signs, silently; this route turns that signature into a token the ops room server can check on
 * its own, with no shared database and no call back to the app. `ROOM_TOKEN_SECRET` is the only thing
 * the two processes share, and it is the same variable the Stage 3 comment Room already uses — one
 * secret for the deployment, not one per feature.
 *
 * A per-process random fallback exists so a dev machine works without configuration, but it is a
 * different value in each process, which means the ops room would refuse every token it minted. That is
 * the correct failure: it is loudly broken rather than quietly unauthenticated.
 */
const SECRET = process.env.ROOM_TOKEN_SECRET ?? randomBytes(32).toString("hex");

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Constant time, matching the room server's own comparison — a MAC is never checked with `===` here. */
function macMatches(payload: string, mac: string): boolean {
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export interface RoomTokenGrant {
  token: string;
  /** When the browser should ask for another one — it renews without a second signature until the session ends. */
  expiresAtMs: number;
  sessionEndsAtMs: number;
  /** Where the room listens, or null when this deployment has not been given one. */
  url: string | null;
}

function grant(claims: RoomTokenClaims): RoomTokenGrant {
  return {
    token: mintRoomToken(claims, sign),
    expiresAtMs: roomTokenExpiresAtMs(claims),
    sessionEndsAtMs: claims.sessionEndsAtMs,
    url: process.env.GAME_ROOM_PUBLIC_URL ?? null,
  };
}

/** The arena this deployment's rooms are about, or null where none is deployed. */
export function roomArena(): { chainId: number; arena: Address } | null {
  const deployment = resolveArenaDeployment(parseMarketsEnv());
  return deployment ? { chainId: deployment.chainId, arena: deployment.gameArena } : null;
}

export type MintOutcome = { ok: true; grant: RoomTokenGrant } | { ok: false; status: number; error: string };

/**
 * A first token: the browser key's signature is verified against the message this app would have asked
 * for, then discarded. The wallet it claims is taken on the key's word here — the reference's `hello` —
 * and checked against the arena's own agent record the moment a seat exists (`handlers.ts` §sendSnapshot).
 */
export async function mintFromSignature(wallet: Address, key: Address, issuedAtMs: number, signature: string, nowMs: number): Promise<MintOutcome> {
  const target = roomArena();
  if (!target) return { ok: false, status: 503, error: "No duel arena is deployed on this network." };
  if (!roomAuthFresh(issuedAtMs, nowMs)) return { ok: false, status: 400, error: "That signature is too old." };

  const message = roomAuthMessage({ wallet, key, chainId: target.chainId, arena: target.arena, issuedAtMs });
  const verified = await verifyMessage({ address: key, message, signature: signature as `0x${string}` }).catch(() => false);
  if (!verified) return { ok: false, status: 401, error: "That signature is not this key's." };

  return { ok: true, grant: grant(roomSessionClaims(wallet, key, target.chainId, target.arena, nowMs)) };
}

/**
 * A later token on the same signature. The presented token must be ours and its session still open —
 * an expired token still renews, because expiry is what renewal is for; a finished session does not.
 */
export function renewFromToken(token: string, nowMs: number): MintOutcome {
  const parsed = parseRoomToken(token);
  if (!parsed || !macMatches(parsed.payload, parsed.mac)) return { ok: false, status: 401, error: "That room token is not ours." };
  if (!canRenewRoomToken(parsed.claims, nowMs)) return { ok: false, status: 401, error: "That room session has ended." };

  const target = roomArena();
  if (!target || parsed.claims.chainId !== target.chainId || parsed.claims.arena !== target.arena.toLowerCase()) {
    return { ok: false, status: 403, error: "That room token was minted for another arena." };
  }

  const next = renewRoomTokenClaims(parsed.claims, nowMs);
  return next ? { ok: true, grant: grant(next) } : { ok: false, status: 401, error: "That room session has ended." };
}

export type TokenWallet = { ok: true; wallet: Address } | { ok: false; status: number; error: string };

/**
 * The wallet a live token claims — the arcade's posting identity, checked the way the room checks it:
 * the MAC first, then the arena binding and the clocks. The claim is the browser key's word for a
 * wallet that never entered a duel; the arcade's label says what that is worth, and no money rides on it.
 */
export function walletFromRoomToken(token: string, nowMs: number): TokenWallet {
  const target = roomArena();
  if (!target) return { ok: false, status: 503, error: "No duel arena is deployed on this network, so no key can vouch for a wallet here." };
  const verdict = verifyRoomToken(token, { chainId: target.chainId, arena: target.arena }, nowMs, macMatches);
  if (!verdict.ok) return { ok: false, status: verdict.code === "forbidden" ? 403 : 401, error: `That room token is not accepted: ${verdict.why}.` };
  return { ok: true, wallet: verdict.claims.wallet };
}

/** The text the browser's key signs, built here so the two copies cannot drift. */
export function roomAuthPrompt(wallet: Address, key: Address, issuedAtMs: number): string | null {
  const target = roomArena();
  return target ? roomAuthMessage({ wallet, key, chainId: target.chainId, arena: target.arena, issuedAtMs }) : null;
}
