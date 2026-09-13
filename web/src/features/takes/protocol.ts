import { COMPOSER_PERMANENCE } from "@masayume/core/copy";
import type { Address, MarketId, Side } from "@masayume/core/types";
import { z } from "zod";

/** One confident sentence, not an essay — the reference's own cap (`lib/sui/takes.ts` L23). */
export const TAKE_MAX_CAPTION = 240;
/** A signature is only good for a few minutes, so a captured one cannot be replayed later. */
export const TAKE_SIGNATURE_TTL_MS = 5 * 60_000;
/** How many takes the reel weaves in — the reference reads 30 (`app/reels/page.tsx` L267). */
export const TAKES_FEED_LIMIT = 30;

/** Trim + hard-cap, as the reference's `normalizeCaption`, so a take stays a take. */
export function normalizeCaption(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, TAKE_MAX_CAPTION);
}

/**
 * The exact text the wallet signs to publish a call.
 *
 * Built here so the browser and the route produce the same string from the same
 * fields. The reference's spine is an on-chain `TakePosted` event (author, market,
 * side, order id); ours is this signature over the same facts, stored with the row
 * so anyone can re-verify who said what about which Window. It names what it is
 * not, because a prompt that does not explain itself trains people to click through
 * the ones that matter — and it repeats the permanence line so nobody signs a
 * public record thinking it is a private note.
 */
export function takeMessage(input: { marketId: string; side: Side; caption: string; address: string; issuedAtMs: number }): string {
  return [
    "Masayume — post a take",
    "",
    `Market: ${input.marketId}`,
    `Call: ${input.side.toUpperCase()}`,
    `Words: ${input.caption || "(no note)"}`,
    `Wallet: ${input.address.toLowerCase()}`,
    `Issued: ${new Date(input.issuedAtMs).toISOString()}`,
    "",
    `Signing proves this take is yours. It is not a transaction, it moves no funds, and it costs nothing. ${COMPOSER_PERMANENCE}`,
  ].join("\n");
}

export const takePostRequestSchema = z.object({
  marketId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  side: z.enum(["up", "down"]),
  // Exactly the words that were signed: the row stores the caption verbatim so the
  // signature re-verifies from the row, so the client normalises before signing and
  // the route refuses anything it would have had to alter.
  caption: z.string().max(TAKE_MAX_CAPTION).refine((caption) => caption === normalizeCaption(caption)),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  issuedAtMs: z.number().int().positive(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2_000),
});

export type TakePostRequest = z.infer<typeof takePostRequestSchema>;

/** One take as the reel renders it — the wire shape of `GET /api/takes`. */
export interface FeedTake {
  id: string;
  marketId: MarketId;
  author: Address;
  side: Side;
  caption: string;
  asset: string;
  intervalSec: number;
  expirySec: number;
  /** The opening print on the oracle scale, as a decimal string; null when posted before the print landed. */
  lineRaw: string | null;
  /** Held a position on the Window when the call was posted — a chain read the server made. */
  backed: boolean;
  createdAtMs: number;
}

export interface TakesFeed {
  /** False when this deployment has no social store; the reel then carries markets alone and the composer says why. */
  configured: boolean;
  takes: FeedTake[];
}
