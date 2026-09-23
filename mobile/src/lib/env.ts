import { parseMarketsEnv, type MarketsEnv } from "@agari/markets/env";
import addresses from "../../../scripts/deploy/addresses.devnet.json";

/** Production web; every API the app reads is a route on it. EXPO_PUBLIC_SITE_URL points a dev build at a local server. */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? "https://useagari.xyz").replace(/\/$/, "");
const PRICE_FEED_URL = process.env.EXPO_PUBLIC_PRICE_FEED_URL ?? "https://ops.useagari.xyz";

const programs = addresses.programs;

/**
 * The same chain-port config web builds from NEXT_PUBLIC_*, with absolute URLs: a phone has no page origin for
 * `/api/index` to resolve against. HTTP RPC goes through web's allowlisted proxy; the websocket stays on public devnet.
 */
export const marketsEnv: MarketsEnv = parseMarketsEnv({
  cluster: addresses.cluster,
  rpcHttpUrls: `${SITE_URL}/api/rpc`,
  indexerUrl: `${SITE_URL}/api/index`,
  priceFeedUrl: PRICE_FEED_URL,
  venueId: addresses.venue.config,
  eventsProgramId: programs.agari_events.programId,
  vaultProgramId: programs.agari_vault.programId,
  rangeProgramId: programs.agari_range.programId,
  parlayProgramId: programs.agari_parlay.programId,
  leverageProgramId: programs.agari_leverage.programId,
  privateProgramId: programs.agari_private.programId,
  arenaProgramId: programs.agari_arena.programId,
  strategyProgramId: programs.agari_strategy.programId,
  makerProgramId: programs.agari_maker.programId,
});
