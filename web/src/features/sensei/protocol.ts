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
  /** The opening print this Window settles against, in whole dollars. */
  lineUsd: z.number().nullable(),
  /** Cents to buy $1 on each side, top of book. Null when nothing rests there. */
  upCents: z.number().int().min(0).max(100).nullable(),
  downCents: z.number().int().min(0).max(100).nullable(),
});

export const senseiSnapshotSchema = z.object({
  priceUsd: z.record(z.string(), z.number()),
  markets: z.array(senseiMarketSchema).max(8),
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
});

export type SenseiMarket = z.infer<typeof senseiMarketSchema>;
export type SenseiSnapshot = z.infer<typeof senseiSnapshotSchema>;
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
