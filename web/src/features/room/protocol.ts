import { z } from "zod";

export const ROOM_BODY_MAX = 280;
/** A join signature is only good for a few minutes, so a captured one cannot be replayed later. */
export const ROOM_SIGNATURE_TTL_MS = 5 * 60_000;
/** How long a joined session lasts before the wallet is asked to sign again. */
export const ROOM_TOKEN_TTL_MS = 60 * 60_000;

/**
 * The exact text the wallet signs to prove it owns the address.
 *
 * Built here so the browser and the route produce the same string from the same
 * fields; a second copy of this format is how a signature starts failing to verify
 * for reasons nobody can see. It names the market and carries a timestamp, so a
 * signature for one Room cannot be presented for another, or replayed tomorrow.
 *
 * It also says what it is not. People are right to be wary of signing things, and
 * a prompt that does not explain itself trains them to click through the ones that
 * matter.
 */
export function roomJoinMessage(marketId: string, address: string, issuedAtMs: number): string {
  return [
    "Masayume — join the Room",
    "",
    `Market: ${marketId}`,
    `Wallet: ${address.toLowerCase()}`,
    `Issued: ${new Date(issuedAtMs).toISOString()}`,
    "",
    "Signing proves you own this wallet. It is not a transaction, it moves no funds, and it costs nothing.",
  ].join("\n");
}

export const roomJoinRequestSchema = z.object({
  marketId: z.string().min(1).max(120),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  issuedAtMs: z.number().int().positive(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2_000),
});

export const roomPostRequestSchema = z.object({
  marketId: z.string().min(1).max(120),
  token: z.string().min(1).max(400),
  body: z.string().trim().min(1).max(ROOM_BODY_MAX),
});

export type RoomJoinRequest = z.infer<typeof roomJoinRequestSchema>;
export type RoomPostRequest = z.infer<typeof roomPostRequestSchema>;

/**
 * Where a wallet stands with one Room — the reference's gate machine
 * (`useCommentRoom.ts` L5–10), with its states kept.
 *
 * `unavailable` is ours: the reference cannot be unconfigured, because its store is
 * the chain. Ours can, and an unconfigured Room must say so rather than looking
 * like a Room nobody has posted in.
 */
export type RoomGate = "unavailable" | "connect" | "locked" | "joinable" | "joining" | "joined";

export interface RoomComment {
  id: string;
  author: string;
  body: string;
  createdAtMs: number;
  mine: boolean;
}
