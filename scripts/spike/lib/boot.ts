import { closeRuntime, ensureMarkets, getClient, parseMarketsEnv, type MarketsEnv } from "@masayume/markets";

export type Client = ReturnType<typeof getClient>;

export interface Spike {
  env: MarketsEnv;
  client: Client;
}

const EXIT_GRACE_MS = 3_000;

/**
 * Opens the shared READ runtime for a spike and guarantees the process exits even if the SDK
 * socket lingers after close(). The exchange object itself is deliberately not handed out —
 * a spike that needs to sign creates its own SubmitterSession, like every other actor.
 */
export async function runSpike(body: (spike: Spike) => Promise<void>): Promise<void> {
  const env = parseMarketsEnv({ venueId: process.env.VENUE_ID });
  ensureMarkets(env);
  try {
    await body({ env, client: getClient() });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeRuntime();
    setTimeout(() => process.exit(process.exitCode ?? 0), EXIT_GRACE_MS).unref();
  }
}

export function short(hex: string): string {
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`;
}
