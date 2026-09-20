import { marketsEnvInputFrom, parseMarketsEnv, type MarketsEnv } from "@agari/markets";

/**
 * The markets runtime's config for an ops actor: the process environment, as the web reads it, with the actor's own
 * venue id on top when it has one.
 *
 * Every ported actor used to call `parseMarketsEnv({ venueId })` and nothing else, so the indexer URL, the price
 * feed and the program ids in the environment were never read. The strategy runner booted, found its key and its
 * live subscriber, and reported "no indexer configured" with the indexer configured. With nothing set this returns
 * exactly what that call returned, so an actor that worked keeps working.
 *
 * An actor is not a browser: `NEXT_PUBLIC_AGARI_INDEXER_URL` has to be absolute here (`http://host/api/index`).
 */
export function opsMarketsEnv(venueId?: string): MarketsEnv {
  return parseMarketsEnv({ ...marketsEnvInputFrom(process.env), ...(venueId ? { venueId } : {}) });
}
