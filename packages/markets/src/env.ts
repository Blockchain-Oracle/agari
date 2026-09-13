import { addressSchema, bytes32Schema } from "@masayume/core/types";
import { z } from "zod";
import { RPC_HTTP_URLS, RPC_WS_URLS, SOMNIA_SHANNON_ID } from "./chain";

export const SHANNON_DEFAULTS = {
  chainId: SOMNIA_SHANNON_ID,
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  rpcWsUrls: [...RPC_WS_URLS],
  rpcHttpUrls: [...RPC_HTTP_URLS],
  venueId: "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c" as const,
  priceFeedQuote: "USDC",
};

const urlList = z.preprocess(
  (raw) => (typeof raw === "string" ? raw.split(",").map((s) => s.trim()).filter(Boolean) : raw),
  z.array(z.url()).min(1),
);

export const marketsEnvSchema = z.object({
  chainId: z.coerce.number().int().default(SHANNON_DEFAULTS.chainId),
  indexerUrl: z.url().default(SHANNON_DEFAULTS.indexerUrl),
  rpcWsUrls: urlList.default(SHANNON_DEFAULTS.rpcWsUrls),
  rpcHttpUrls: urlList.default(SHANNON_DEFAULTS.rpcHttpUrls),
  venueId: bytes32Schema.default(SHANNON_DEFAULTS.venueId),
  priceFeedUrl: z.url().optional(),
  priceFeedQuote: z.string().default(SHANNON_DEFAULTS.priceFeedQuote),
  /** Local-fork overrides for the EventVault; production reads the generated addresses module (AD-10). */
  eventVaultAddress: addressSchema.optional(),
  forwarderAddress: addressSchema.optional(),
  eventVaultFromBlock: z.coerce.bigint().optional(),
  /** Local-fork overrides for the ParlayReserve, the same way. */
  parlayReserveAddress: addressSchema.optional(),
  parlayReserveFromBlock: z.coerce.bigint().optional(),
  /** Local-fork overrides for the RangeReserve, the same way. */
  rangeReserveAddress: addressSchema.optional(),
  rangeReserveFromBlock: z.coerce.bigint().optional(),
  /** Local-fork overrides for the MarketMakerVault, the same way. */
  marketMakerVaultAddress: addressSchema.optional(),
  marketMakerVaultFromBlock: z.coerce.bigint().optional(),
  /** A local fork's LeverageReserve; production reads the generated module (AD-10). */
  leverageReserveAddress: addressSchema.optional(),
  leverageReserveFromBlock: z.coerce.bigint().optional(),
  /** A local fork's PrivateDesk; production reads the generated module (AD-10). */
  privateDeskAddress: addressSchema.optional(),
  privateDeskFromBlock: z.coerce.bigint().optional(),
  /** A local fork's GameArena; production reads the generated module (AD-10). */
  gameArenaAddress: addressSchema.optional(),
  gameArenaFromBlock: z.coerce.bigint().optional(),
});

export type MarketsEnv = z.infer<typeof marketsEnvSchema>;
export type MarketsEnvInput = z.input<typeof marketsEnvSchema>;

/** Parses the chain-port config with baked Shannon defaults: every field is optional, so a deploy with no env still boots. */
export function parseMarketsEnv(raw: Partial<Record<keyof MarketsEnvInput, unknown>> = {}): MarketsEnv {
  const defined = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== ""));
  return marketsEnvSchema.parse(defined);
}
