import { marketsEnvInputFrom, parseMarketsEnv, type MarketsEnv } from "@agari/markets";
import { readOpsEnv } from "./env";

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
 *
 * With no `NEXT_PUBLIC_SOLANA_RPC_URL` the runtime used to fall back to the public devnet endpoint while the rest of
 * the process spoke to the keyed one. The leverage keeper's first live cycles took 11 s to mark one position that
 * way, on a job where seconds are the point. An actor now reads through the endpoints the ops process itself uses
 * (`readOpsEnv`); the key stays in this server process, as it always has for the venue's own actors.
 *
 * The price feed is this process's own `/prices/latest`. With no `NEXT_PUBLIC_PRICE_FEED_URL` on the ops container
 * every `getAssetPrice` answered null, so the strategy runner skipped every Window as "no fresh price" (S23).
 */
export function opsMarketsEnv(venueId?: string): MarketsEnv {
  const input = marketsEnvInputFrom(process.env);
  const ops = readOpsEnv();
  return parseMarketsEnv({
    ...input,
    rpcHttpUrls: input.rpcHttpUrls ?? ops.rpcUrl,
    rpcWsUrls: input.rpcWsUrls ?? ops.rpcSubscriptionsUrl,
    priceFeedUrl: input.priceFeedUrl ?? `http://127.0.0.1:${ops.httpPort}`,
    ...(venueId ? { venueId } : {}),
  });
}
