import { parseMarketsEnv, type MarketsEnv } from "@agari/markets/env";
import { z } from "zod";

const webOnlySchema = z.object({
  /** Browser RPC. Never the Helius key: S4 decides between a proxy and an allowlisted endpoint. */
  solanaRpcUrl: z.url().default("https://api.devnet.solana.com"),
  solanaWsUrl: z.url().default("wss://api.devnet.solana.com"),
  appOrigin: z.url().default("http://localhost:3000"),
});

export interface WebEnv extends z.infer<typeof webOnlySchema> {
  markets: MarketsEnv;
}

// Every NEXT_PUBLIC_* variable is referenced literally so Next can inline it into the client bundle.
// Each one is optional: with no .env at all the app boots against Solana devnet from baked defaults.
export const webEnv: WebEnv = {
  markets: parseMarketsEnv({
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
    rpcHttpUrls: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    rpcWsUrls: process.env.NEXT_PUBLIC_SOLANA_WS_URL,
    indexerUrl: process.env.NEXT_PUBLIC_AGARI_INDEXER_URL,
    venueId: process.env.NEXT_PUBLIC_AGARI_VENUE_ID,
    eventsProgramId: process.env.NEXT_PUBLIC_AGARI_EVENTS_PROGRAM_ID,
    vaultProgramId: process.env.NEXT_PUBLIC_AGARI_VAULT_PROGRAM_ID,
    rangeProgramId: process.env.NEXT_PUBLIC_AGARI_RANGE_PROGRAM_ID,
    parlayProgramId: process.env.NEXT_PUBLIC_AGARI_PARLAY_PROGRAM_ID,
    leverageProgramId: process.env.NEXT_PUBLIC_AGARI_LEVERAGE_PROGRAM_ID,
    privateProgramId: process.env.NEXT_PUBLIC_AGARI_PRIVATE_PROGRAM_ID,
    strategyProgramId: process.env.NEXT_PUBLIC_AGARI_STRATEGY_PROGRAM_ID,
    makerProgramId: process.env.NEXT_PUBLIC_AGARI_MAKER_PROGRAM_ID,
    priceFeedUrl: process.env.NEXT_PUBLIC_PRICE_FEED_URL,
  }),
  ...webOnlySchema.parse({
    solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || undefined,
    solanaWsUrl: process.env.NEXT_PUBLIC_SOLANA_WS_URL || undefined,
    appOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN || undefined,
  }),
};
