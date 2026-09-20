import { CLUSTER_ID, DEFAULT_CLUSTER, type Cluster } from "@agari/core/constants";
import { addressSchema } from "@agari/core/types";
import { z } from "zod";

/** Public Solana devnet endpoints: rate-limited but keyless, so a deploy with no env still boots (a Helius key stays server-side). */
export const DEVNET_DEFAULTS = {
  cluster: DEFAULT_CLUSTER,
  rpcHttpUrls: ["https://api.devnet.solana.com"],
  rpcWsUrls: ["wss://api.devnet.solana.com"],
} as const;

const urlList = z.preprocess(
  (raw) => (typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : raw),
  z.array(z.url()).min(1),
);

export const marketsEnvSchema = z.object({
  cluster: z.enum(["mainnet-beta", "devnet", "localnet"]).default(DEVNET_DEFAULTS.cluster),
  rpcHttpUrls: urlList.default([...DEVNET_DEFAULTS.rpcHttpUrls]),
  rpcWsUrls: urlList.default([...DEVNET_DEFAULTS.rpcWsUrls]),
  /**
   * The Agari indexer API (S3): an absolute URL, or a same-origin path such as `/api/index` (the default in web). A path
   * resolves against the page's origin in the browser, so any host or port works, and against this server over
   * loopback on the server (`indexer-base.ts`).
   */
  indexerUrl: z
    .string()
    .refine((value) => value.startsWith("/") || URL.canParse(value), "an absolute URL or a same-origin path like /api/index")
    .optional(),
  /** The agari-events `GlobalConfig` address; absent until S2 deploys (D-010). */
  venueId: addressSchema.optional(),
  /** The agari-events program id; absent until S2 deploys. `program-id-drift` checks it against the IDL once present. */
  eventsProgramId: addressSchema.optional(),
  /** The agari-vault program id (S7); absent until it deploys. Must equal `addresses.devnet.json` `programs.agari_vault`. */
  vaultProgramId: addressSchema.optional(),
  /** The agari-range program id (S10b); absent until it deploys. Must equal `addresses.devnet.json` `programs.agari_range`. */
  rangeProgramId: addressSchema.optional(),
  /** The agari-parlay program id (S10a); absent until it deploys. Must equal `addresses.devnet.json` `programs.agari_parlay`. */
  parlayProgramId: addressSchema.optional(),
  leverageProgramId: addressSchema.optional(),
  /** The agari-strategy program id (S9); absent until it deploys. Must equal `addresses.devnet.json` `programs.agari_strategy`. */
  strategyProgramId: addressSchema.optional(),
  /** The agari-maker program id (S8); absent until it deploys. Must equal `addresses.devnet.json` `programs.agari_maker`. */
  makerProgramId: addressSchema.optional(),
  /** price-relay's spot SSE endpoint (S3). */
  priceFeedUrl: z.url().optional(),
});

export type MarketsEnvParsed = z.infer<typeof marketsEnvSchema>;

/** The chain-port config. `chainId` is the numeric cluster id product types still bind (D-012), derived, never configured. */
export type MarketsEnv = MarketsEnvParsed & { chainId: number };
export type MarketsEnvInput = z.input<typeof marketsEnvSchema>;

/** Parses the chain-port config with devnet defaults: every field is optional. */
export function parseMarketsEnv(raw: Partial<Record<keyof MarketsEnvInput, unknown>> = {}): MarketsEnv {
  const defined = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = marketsEnvSchema.parse(defined);
  return { ...parsed, chainId: CLUSTER_ID[parsed.cluster as Cluster] };
}

/**
 * The env-var names a web or ops process maps into `parseMarketsEnv`. Kept as literal property reads so Next.js
 * inlines the `NEXT_PUBLIC_*` values into client bundles.
 */
export function marketsEnvInputFrom(source: Record<string, string | undefined>): Partial<Record<keyof MarketsEnvInput, unknown>> {
  return {
    cluster: source.NEXT_PUBLIC_SOLANA_CLUSTER,
    rpcHttpUrls: source.NEXT_PUBLIC_SOLANA_RPC_URL,
    rpcWsUrls: source.NEXT_PUBLIC_SOLANA_WS_URL,
    indexerUrl: source.NEXT_PUBLIC_AGARI_INDEXER_URL,
    venueId: source.NEXT_PUBLIC_AGARI_VENUE_ID,
    eventsProgramId: source.NEXT_PUBLIC_AGARI_EVENTS_PROGRAM_ID,
    vaultProgramId: source.NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID,
    rangeProgramId: source.NEXT_PUBLIC_AGARI_RANGE_PROGRAM_ID,
    parlayProgramId: source.NEXT_PUBLIC_AGARI_PARLAY_PROGRAM_ID,
    leverageProgramId: source.NEXT_PUBLIC_AGARI_LEVERAGE_PROGRAM_ID,
    strategyProgramId: source.NEXT_PUBLIC_AGARI_STRATEGY_PROGRAM_ID,
    makerProgramId: source.NEXT_PUBLIC_AGARI_MAKER_PROGRAM_ID,
    priceFeedUrl: source.NEXT_PUBLIC_PRICE_FEED_URL,
  };
}
