import { messageSignatureSchema, networkLine, SIGNED_MESSAGE_BRAND } from "@agari/core/auth";
import { DEFAULT_CLUSTER } from "@agari/core/constants";
import { addressSchema } from "@agari/core/types";
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
 * for reasons nobody can see. It names the Room (a Market or a `$TICKER`) and carries a
 * timestamp, so a signature for one Room cannot be presented for another, or replayed tomorrow.
 *
 * It also says what it is not. People are right to be wary of signing things, and
 * a prompt that does not explain itself trains them to click through the ones that
 * matter.
 */
export function roomJoinMessage(roomId: string, address: string, issuedAtMs: number): string {
  return [
    `${SIGNED_MESSAGE_BRAND} — join the Room`,
    "",
    // A ticker Room (`$TSLA`, room-id.ts) names itself as a Room; a Window's Room names its Market, as it always has.
    roomId.startsWith("$") ? `Room: ${roomId}` : `Market: ${roomId}`,
    // Base58 is case-sensitive: the wallet is named exactly as it signs (D-010).
    `Wallet: ${address}`,
    networkLine(DEFAULT_CLUSTER),
    `Issued: ${new Date(issuedAtMs).toISOString()}`,
    "",
    "Signing proves you own this wallet. It is not a transaction, it moves no funds, and it costs nothing.",
  ].join("\n");
}

/** `marketId` carries any room id (room-id.ts): a Market id or `$TICKER`; routes parse it before use. */
export const roomJoinRequestSchema = z.object({
  marketId: z.string().min(1).max(120),
  address: addressSchema,
  issuedAtMs: z.number().int().positive(),
  signature: messageSignatureSchema,
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
