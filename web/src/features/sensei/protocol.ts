import type { SessionState } from "@agari/core/market";
import { z } from "zod";

/**
 * What the browser sends Sensei, and what it gets back.
 *
 * Shared by the client and the route so the two cannot drift, and validated on
 * the server because everything in this object arrives from a browser.
 *
 * One field of the reference's is deliberately absent: it posts `userId` (the
 * wallet address) to a MemWal relayer that remembers what each person asked
 * about. There is no such store here, so sending an address would put a wallet
 * on the wire for a feature that does not exist. If persistent memory is built
 * later it needs its own decision, not a field that arrived early.
 */
export const senseiMarketSchema = z.object({
  asset: z.string().max(16),
  cadence: z.string().max(8),
  minsToClose: z.number().int().min(0).max(100_000),
  /** The opening print this Window settles against, in dollars: whole from $1,000 up, cents below. */
  lineUsd: z.number().nullable(),
  /** Cents to buy $1 on each side, top of book. Null when nothing rests there. */
  upCents: z.number().int().min(0).max(100).nullable(),
  downCents: z.number().int().min(0).max(100).nullable(),
});

export const senseiSnapshotSchema = z.object({
  priceUsd: z.record(z.string(), z.number()),
  markets: z.array(senseiMarketSchema).max(8),
});

/** The NYSE session as `useMarketSession()` states it: the core state and its one-line label. */
const SESSION_STATES = ["pre", "regular", "early-close", "halted", "post", "closed", "holiday"] as const satisfies readonly SessionState[];

export const senseiSessionSchema = z.object({
  state: z.enum(SESSION_STATES),
  label: z.string().max(40),
});

/** One of the reader's open Windows. Money is integer cents; nothing here names the wallet. */
export const senseiPositionSchema = z.object({
  asset: z.string().max(16),
  cadence: z.string().max(8),
  side: z.enum(["up", "down", "both"]),
  /** What stayed in, from the fills. */
  stakeCents: z.number().int().min(0).max(1e12),
  /** Held lots at the last trade, each side in its own terms. */
  markCents: z.number().int().min(0).max(1e12),
  minsToClose: z.number().int().min(0).max(100_000),
});

/** Settled rounds. `streak` is signed: +3 won the last three, −3 lost the last three, over decided rounds. */
export const senseiRecordSchema = z.object({
  settled: z.number().int().min(0).max(1e6),
  wins: z.number().int().min(0).max(1e6),
  losses: z.number().int().min(0).max(1e6),
  streak: z.number().int().min(-1e6).max(1e6),
});

/**
 * One stock token the reader's wallet holds, as the cover card reads it (plan Step 8, Sensei note): real tokens on
 * mainnet, read-only, never test funds. Nothing here names the wallet or the mint. `valueCents` is null when the only
 * known price is stale.
 */
export const senseiHoldingSchema = z.object({
  name: z.string().max(24),
  symbol: z.string().max(16),
  issuer: z.enum(["xstocks", "ondo", "prestocks"]),
  /** "4.2" · "12.5": the token amount as text, at most four decimals. */
  tokens: z.string().max(24),
  valueCents: z.number().int().min(0).max(1e12).nullable(),
});

export const senseiRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4_000),
      }),
    )
    // The reference keeps the last 12 turns; the same window, enforced server-side.
    .max(12),
  snapshot: senseiSnapshotSchema.nullable(),
  /** The client saw rapid-fire asking — a tilt cue for the brake. */
  restless: z.boolean(),
  // Additive and optional (S13 spec §1.1): absent means unknown, never "none".
  session: senseiSessionSchema.nullable().optional(),
  /** Read only while the drawer is open and a wallet is connected. */
  positions: z.array(senseiPositionSchema).max(8).optional(),
  record: senseiRecordSchema.optional(),
  /** The wallet's stock tokens, read only while the drawer is open and a wallet is connected; absent means unknown. */
  holdings: z.array(senseiHoldingSchema).max(4).optional(),
});

export type SenseiMarket = z.infer<typeof senseiMarketSchema>;
export type SenseiSnapshot = z.infer<typeof senseiSnapshotSchema>;
export type SenseiSession = z.infer<typeof senseiSessionSchema>;
export type SenseiPosition = z.infer<typeof senseiPositionSchema>;
export type SenseiRecord = z.infer<typeof senseiRecordSchema>;
export type SenseiHolding = z.infer<typeof senseiHoldingSchema>;
export type SenseiRequest = z.infer<typeof senseiRequestSchema>;

export interface SenseiMessage {
  role: "user" | "assistant";
  content: string;
  /**
   * This assistant turn is a failure notice, not a read.
   *
   * It still belongs in the thread — the reference puts its errors there too, and a
   * conversation that silently drops a turn is worse. But it must not count as a
   * read: an unreachable brain should not open the trade cards or offer "Why?" and
   * "What's the risk?" as follow-ups to a configuration error. Stripped before the
   * request; the model never sees it.
   */
  failed?: true;
}
