// Dev runner: the seat-mode seed maker alone, with a dev-only RedStone "latest" poller as its spot feed (price-relay's
// real SpotFeed replaces it in main.ts). `pnpm --filter @agari/ops exec tsx --env-file-if-exists=../../.env.local src/dev/seed-maker.ts`
// Env: SOLANA_CLUSTER=localnet SURFPOOL_PORT=… ; DRY_RUN=0 to send; MM_* knobs (venue-ops.md §8).
import { TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { decimalToE8, parseGatewayJson, redstoneMedianE8 } from "@agari/markets/deploy";
import { createSessionService } from "../calendar/session-service";
import { createHaltBoard, createSessionEvents, readOpsEnv } from "../runtime";
import type { SpotFeed, SpotQuote } from "../prices/spot";
import { startSeedMaker } from "../actors/market-maker/seat";

const LATEST = "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-primary-prod";
const POLL_MS = 5_000;

function devRedstoneSpot(log: (why: string) => void): SpotFeed {
  const quotes = new Map<string, SpotQuote>();
  const listeners = new Set<(q: SpotQuote) => void>();
  const poll = async () => {
    try {
      const res = await fetch(LATEST, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const all = parseGatewayJson(await res.text());
      for (const symbol of TICKER_SYMBOLS) {
        const feed = TICKERS[symbol].redstoneFeedId;
        const packages = feed ? (all[feed] ?? []) : [];
        if (packages.length === 0) continue;
        const priceE8 = redstoneMedianE8(packages.map((p) => decimalToE8(String(p.dataPoints[0]!.value))));
        const quote: SpotQuote = { symbol, priceE8, publishTimeSec: Math.floor(Math.min(...packages.map((p) => p.timestampMilliseconds)) / 1000), source: "redstone" };
        quotes.set(symbol, quote);
        listeners.forEach((l) => l(quote));
      }
    } catch (error) {
      log(`dev spot poll failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  void poll();
  setInterval(() => void poll(), POLL_MS);
  return {
    latest: (symbol, maxAgeSec = 30) => {
      const q = quotes.get(symbol);
      return q && Date.now() / 1000 - q.publishTimeSec <= maxAgeSec ? q : null;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const env = readOpsEnv();
const log = (why: string) => console.log(JSON.stringify({ tsMs: Date.now(), actor: "seed-maker", why }));
const sessions = createSessionService();
log(await sessions.refresh());
await startSeedMaker({ env, log, sessions, spot: devRedstoneSpot(log), halts: createHaltBoard(), events: createSessionEvents() });
