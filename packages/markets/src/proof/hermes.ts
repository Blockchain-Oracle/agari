/**
 * The archived Hermes answer for a boundary (`print_archive.payload`, schema-prints.ts): `binary.data[0]` is the signed
 * accumulator update for every trial feed at T, and `parsed[]` is Hermes' own reading of it. The replay checks the
 * parsed feed against the settled print before anything is sent (proof-analytics.md §2.6 step 2).
 */
import { z } from "zod";
import { printDiff } from "./decode";

const intText = z.string().regex(/^-?\d+$/);

const parsedFeed = z.object({
  id: z.string(),
  price: z.object({ price: intText, conf: intText, expo: z.number().int(), publish_time: z.number().int() }),
  metadata: z.object({ prev_publish_time: z.number().int().optional() }).passthrough().optional(),
});

const hermesPayload = z.object({
  binary: z.object({ encoding: z.literal("base64").optional(), data: z.array(z.string().min(1)).min(1) }),
  parsed: z.array(parsedFeed).min(1),
});

export interface HermesFeed {
  feedIdHex: string;
  price: bigint;
  conf: bigint;
  exponent: number;
  publishTimeSec: number;
}

export interface ArchivedUpdate {
  /** Base64 accumulator updates, in archive order (one per Hermes answer). */
  updatesBase64: string[];
  feeds: HermesFeed[];
}

const bareHex = (id: string): string => id.replace(/^0x/, "").toLowerCase();

/** Parses the exact archived text. JSON numbers here are small integers (expo, seconds); prices stay decimal strings. */
export function parseArchivedUpdate(payload: string): ArchivedUpdate {
  const body = hermesPayload.parse(JSON.parse(payload));
  return {
    updatesBase64: body.binary.data,
    feeds: body.parsed.map((f) => ({
      feedIdHex: bareHex(f.id),
      price: BigInt(f.price.price),
      conf: BigInt(f.price.conf),
      exponent: f.price.expo,
      publishTimeSec: f.price.publish_time,
    })),
  };
}

export type PreflightRefusal = { kind: "feed-missing" } | { kind: "publish-time"; publishTimeSec: number } | { kind: "price"; diff: bigint };

/** Null when the archived feed is exactly the settled print at T; otherwise why the replay must not send. */
export function preflightRefusal(update: ArchivedUpdate, feedIdHex: string, boundarySec: number, printE8: bigint): PreflightRefusal | null {
  const feed = update.feeds.find((f) => f.feedIdHex === bareHex(feedIdHex));
  if (!feed) return { kind: "feed-missing" };
  if (feed.publishTimeSec !== boundarySec) return { kind: "publish-time", publishTimeSec: feed.publishTimeSec };
  const diff = printDiff(feed.price, feed.exponent, printE8);
  return diff === 0n ? null : { kind: "price", diff };
}
