import { messageSignatureSchema, networkLine, SIGNED_MESSAGE_BRAND } from "@agari/core/auth";
import { DEFAULT_CLUSTER } from "@agari/core/constants";
import { addressSchema, type Address } from "@agari/core/types";
import { z } from "zod";

/** The token scope a social session is minted under (`gate.server.ts` `mintToken`), never a room id. */
export const SOCIAL_SCOPE = "social";
/** A session signature is only good for a few minutes, so a captured one cannot be replayed later. */
export const SOCIAL_SIGNATURE_TTL_MS = 5 * 60_000;
/** How long one signature keeps follow and unfollow working (the room token's hour). */
export const SOCIAL_TOKEN_TTL_MS = 60 * 60_000;

/**
 * The exact text the wallet signs once to open a social session.
 *
 * Built here so the browser and the route produce the same string from the same fields. It names the wallet and
 * the cluster, carries a timestamp so it cannot be replayed tomorrow, and says plainly what it allows and what it
 * does not: a prompt that does not explain itself trains people to click through the ones that matter.
 */
export function socialSessionMessage(address: string, issuedAtMs: number): string {
  return [
    `${SIGNED_MESSAGE_BRAND} — start a social session`,
    "",
    // Base58 is case-sensitive: the wallet is named exactly as it signs (D-010).
    `Wallet: ${address}`,
    networkLine(DEFAULT_CLUSTER),
    `Issued: ${new Date(issuedAtMs).toISOString()}`,
    "",
    "Signing lets Agari record who you follow. It is not a transaction, it moves no funds, and it costs nothing.",
  ].join("\n");
}

export const socialSessionRequestSchema = z.object({
  address: addressSchema,
  issuedAtMs: z.number().int().positive(),
  signature: messageSignatureSchema,
});

export const followWriteSchema = z.object({
  token: z.string().min(1).max(400),
  followee: addressSchema,
  follow: z.boolean(),
});

export type SocialSessionRequest = z.infer<typeof socialSessionRequestSchema>;
export type FollowWrite = z.infer<typeof followWriteSchema>;

export interface SocialSession {
  token: string;
  expiresAtMs: number;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

/** The wire shape of `GET /api/social/follows?wallet`: whom the wallet follows (newest first) and both counts. */
export interface FollowsPayload {
  /** False when this deployment has no social store; every follow control then says so instead of acting. */
  configured: boolean;
  wallet: Address;
  following: Address[];
  counts: FollowCounts;
}

/** `POST /api/social/follows` answers with the follower's fresh graph and the followee's fresh counts. */
export interface FollowWriteResult {
  follower: FollowsPayload;
  followee: { wallet: Address; counts: FollowCounts };
}

/** Spec §4: staleTime 60 s, written on every follow or unfollow. */
export const FOLLOWS_STALE_MS = 60_000;
export const followsKey = (wallet: string | null) => ["agari", "social", "follows", wallet] as const;
