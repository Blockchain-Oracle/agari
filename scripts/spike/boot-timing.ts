import { isOk, type Reading } from "@masayume/core";
import {
  closeRuntime,
  configureMarkets,
  loadCollateral,
  parseMarketsEnv,
  resolveVenueId,
  syncClock,
} from "@masayume/markets";

type TimedReading = {
  name: "clock" | "collateral" | "venue";
  elapsedMs: number;
  ok: boolean;
  detail: string;
};

const wsIndex = Number.parseInt(process.env.BOOT_WS_INDEX ?? "0", 10);
const env = parseMarketsEnv({ venueId: process.env.VENUE_ID });

if (!Number.isInteger(wsIndex) || wsIndex < 0 || wsIndex >= env.rpcWsUrls.length) {
  throw new Error(`BOOT_WS_INDEX must select one of ${env.rpcWsUrls.length} configured WebSocket endpoints`);
}

configureMarkets(env, { wsIndex });

async function timed<T>(name: TimedReading["name"], read: () => Promise<Reading<T>>): Promise<TimedReading> {
  const startedAt = performance.now();
  const result = await read();
  const elapsedMs = Math.round(performance.now() - startedAt);
  return {
    name,
    elapsedMs,
    ok: isOk(result),
    detail: isOk(result) ? "ok" : `${result.error.kind}: ${result.error.technical}`,
  };
}

try {
  const startedAt = performance.now();
  const readings = await Promise.all([
    timed("clock", syncClock),
    timed("collateral", loadCollateral),
    timed("venue", () => resolveVenueId(env.venueId)),
  ]);
  console.log(
    JSON.stringify(
      {
        wsIndex,
        wsUrl: env.rpcWsUrls[wsIndex],
        indexerUrl: env.indexerUrl,
        totalMs: Math.round(performance.now() - startedAt),
        readings,
      },
      null,
      2,
    ),
  );
} finally {
  // Some SDK WebSocket handles outlive close(). Do not let a diagnostic process hang forever.
  await Promise.race([
    closeRuntime(),
    new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
  ]);
  process.exit(process.exitCode ?? 0);
}
