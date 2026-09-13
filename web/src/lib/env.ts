import { parseMarketsEnv, type MarketsEnv } from "@masayume/markets/env";
import { z } from "zod";

const webOnlySchema = z.object({
  walletConnectProjectId: z.string().min(1).optional(),
  appOrigin: z.url().default("http://localhost:3000"),
});

export interface WebEnv extends z.infer<typeof webOnlySchema> {
  markets: MarketsEnv;
}

// Every NEXT_PUBLIC_* variable is referenced literally so Next can inline it into the client bundle.
// Each one is optional: with no .env at all the app boots against Somnia Shannon from baked defaults.
export const webEnv: WebEnv = {
  markets: parseMarketsEnv({
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
    indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL,
    rpcWsUrls: process.env.NEXT_PUBLIC_RPC_WS_URLS,
    rpcHttpUrls: process.env.NEXT_PUBLIC_RPC_HTTP_URLS,
    venueId: process.env.NEXT_PUBLIC_VENUE_ID,
    priceFeedUrl: process.env.NEXT_PUBLIC_PRICE_FEED_URL,
    priceFeedQuote: process.env.NEXT_PUBLIC_PRICE_FEED_QUOTE,
    // Local-fork overrides for the EventVault; production reads the generated addresses module (AD-10).
    eventVaultAddress: process.env.NEXT_PUBLIC_EVENT_VAULT_ADDRESS,
    forwarderAddress: process.env.NEXT_PUBLIC_FORWARDER_ADDRESS,
    eventVaultFromBlock: process.env.NEXT_PUBLIC_EVENT_VAULT_FROM_BLOCK,
    parlayReserveAddress: process.env.NEXT_PUBLIC_PARLAY_RESERVE_ADDRESS,
    parlayReserveFromBlock: process.env.NEXT_PUBLIC_PARLAY_RESERVE_FROM_BLOCK,
    rangeReserveAddress: process.env.NEXT_PUBLIC_RANGE_RESERVE_ADDRESS,
    rangeReserveFromBlock: process.env.NEXT_PUBLIC_RANGE_RESERVE_FROM_BLOCK,
    marketMakerVaultAddress: process.env.NEXT_PUBLIC_MARKET_MAKER_VAULT_ADDRESS,
    marketMakerVaultFromBlock: process.env.NEXT_PUBLIC_MARKET_MAKER_VAULT_FROM_BLOCK,
    leverageReserveAddress: process.env.NEXT_PUBLIC_LEVERAGE_RESERVE_ADDRESS,
    leverageReserveFromBlock: process.env.NEXT_PUBLIC_LEVERAGE_RESERVE_FROM_BLOCK,
    privateDeskAddress: process.env.NEXT_PUBLIC_PRIVATE_DESK_ADDRESS,
    privateDeskFromBlock: process.env.NEXT_PUBLIC_PRIVATE_DESK_FROM_BLOCK,
  }),
  ...webOnlySchema.parse({
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || undefined,
    appOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN || undefined,
  }),
};
