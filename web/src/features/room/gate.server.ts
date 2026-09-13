import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Address } from "@masayume/core/types";
import { hasBet } from "@masayume/db";
import { ensureMarkets, marketsProvider, parseMarketsEnv } from "@masayume/markets";
import { verifyMessage } from "viem";
import { ROOM_TOKEN_TTL_MS, roomJoinMessage } from "./protocol";

/**
 * The Room's authority — server only. Nothing here may be imported by a component.
 *
 * Two facts have to be true before a wallet may read or post, and both are checked
 * here rather than in the browser: it owns the address it claims (a signature), and
 * it holds a position on this market (a chain read). A gate that lives only in the
 * UI is not a gate — the sheet says "bettors only", so the server has to mean it.
 */

/**
 * The key that signs session tokens.
 *
 * `ROOM_TOKEN_SECRET` keeps sessions valid across restarts and across instances; a
 * per-process random key is the fallback, which is correct but means a redeploy or
 * a dev reload asks the wallet to sign again. That is a nuisance, never a hole.
 */
const SECRET = process.env.ROOM_TOKEN_SECRET ?? randomBytes(32).toString("hex");

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** `<address>.<marketId>.<expiry>.<mac>` — the claim travels with its own signature. */
export function mintToken(address: string, marketId: string, nowMs: number): string {
  const payload = `${address.toLowerCase()}.${marketId}.${nowMs + ROOM_TOKEN_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** The address this token proves, or null. Constant-time compare, so a MAC cannot be probed byte by byte. */
export function readToken(token: string, marketId: string, nowMs: number): string | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [address, tokenMarketId, expiry, mac] = parts as [string, string, string, string];
  if (tokenMarketId !== marketId) return null;
  if (!/^\d+$/.test(expiry) || Number(expiry) <= nowMs) return null;

  const expected = Buffer.from(sign(`${address}.${tokenMarketId}.${expiry}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return address;
}

/** Whether the signature really is this address's, over the message we would have asked for. */
export async function verifyJoinSignature(marketId: string, address: string, issuedAtMs: number, signature: string): Promise<boolean> {
  try {
    return await verifyMessage({
      address: address as `0x${string}`,
      message: roomJoinMessage(marketId, address, issuedAtMs),
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

/**
 * Has this wallet bet on this Window?
 *
 * The reference's rule is `bet_registry::has_bet` — ever bet, written by the bet itself. Ours is the
 * `bettors` registry the fill lanes report to and the server verifies from the receipt (`/api/room/bet`),
 * which answers for every route: a 2× boost, a private bet and a Trading Balance bet all count, none of
 * which ever put outcome tokens in the wallet. Holding the tokens is the fallback for a fill the registry
 * never heard about, and it still lags the indexer — the registry does not.
 */
export async function holdsPosition(address: string, marketId: string): Promise<boolean> {
  const env = parseMarketsEnv();
  const seat = await hasBet(env.chainId, marketId, address);
  if (seat) return true;
  ensureMarkets(env);
  const reading = await marketsProvider.listOpenPositions(address as Address);
  if (!reading.ok) throw new Error(reading.error.kind);
  return reading.value.some((position) => position.marketId === marketId);
}
