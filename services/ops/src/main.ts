/**
 * The single long-running ops service (AD-8). Each actor is a single writer over its own key and
 * registers here; every cycle logs a structured why-string, and idle is a heartbeat, never silence.
 *
 * S3 venue actors (venue-ops.md §2.5) share one session calendar and price-relay's spot feed; S6 adds the halt board
 * and the session events (session-lanes.md §3). `OPS_ACTORS` names
 * what runs: the default is the venue set; `all` adds the Masayume-era actors, which idle until their stages deploy
 * the programs they drive. DRY_RUN stays on unless `DRY_RUN=0` (nothing signs by default).
 */
import { startDuelProjector } from "./actors/duel-projector";
import { startDuelSettler } from "./actors/duel-settler";
import { startGameRoom } from "./actors/game-room";
import { startHaltWatch } from "./actors/halt-watch";
import { startIndexer } from "./actors/indexer";
import { startLeverageKeeper } from "./actors/leverage-keeper";
import { startMarketMaker } from "./actors/market-maker";
import { startSeedMaker } from "./actors/market-maker/seat";
import { startPriceRelay } from "./actors/price-relay";
import { startSettler } from "./actors/settler";
import { startStrategyRunner } from "./actors/strategy-runner";
import { startWindowRoller } from "./actors/window-roller";
import { startXRelay } from "./actors/x-relay";
import { startEarnings } from "./calendar/earnings";
import { createSessionService } from "./calendar/session-service";
import { startOpsHttp } from "./http/server";
import type { SpotFeed } from "./prices/spot";
import { createXStockSpotFeed, joinXStockSpot } from "./prices/xstock-spot";
import { createPreStocksSpotFeed, joinPreStocksSpot, PRESTOCKS_SPOT_EVERY_MS, type PreStocksSpotHandle } from "./prices/prestocks-spot";
import { createHaltBoard, createSessionEvents, errorText, heartbeats, readOpsEnv, redact, type VenueDeps } from "./runtime";

const HEARTBEAT_MS = 30_000;
/** A pass running longer than this is stuck (no send outlives its 120 s timeout): exit and let the supervisor restart. */
const STUCK_PASS_MS = Number(process.env.OPS_STUCK_PASS_MS) || 10 * 60_000;
const VENUE_ACTORS = ["relay", "roller", "settler", "maker", "indexer", "http", "halts", "earnings"] as const;
const LEGACY_ACTORS = ["strategy-runner", "x-relay", "leverage-keeper", "game-room", "duel-projector", "duel-settler"] as const;

function whyString(actor: string, why: string): string {
  return JSON.stringify({ tsMs: Date.now(), actor, why: redact(why) });
}

const log = (actor: string) => (why: string) => console.log(whyString(actor, why));

function selectedActors(raw: string | undefined): Set<string> {
  const names = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) return new Set(VENUE_ACTORS);
  if (names.includes("all")) return new Set([...VENUE_ACTORS, ...LEGACY_ACTORS]);
  return new Set(names);
}

/** The exit code for an actor that failed to start (D-098); the watchdog's stuck-pass exit is 70. */
const EXIT_START_FAILED = 78;

/**
 * Starts one actor. A start failure is fatal (D-098): ops logs it and exits non-zero so the supervisor restarts the
 * whole process after its 10 s sleep. Before this, one actor could die at boot (`getaddrinfo ENOTFOUND`, a Postgres
 * `CONNECT_TIMEOUT`) while the others kept the process alive, and the venue ran without a roller or an indexer for
 * up to 98 minutes until someone noticed.
 */
function boot<T>(actor: string, start: () => Promise<T>): Promise<T> {
  return start().catch((error: unknown): never => {
    log(actor)(`failed to start: ${errorText(error)} · exiting ${EXIT_START_FAILED} so the supervisor restarts ops (D-098)`);
    process.exit(EXIT_START_FAILED);
  });
}

const env = readOpsEnv();
const actors = selectedActors(process.env.OPS_ACTORS);
console.log(whyString("ops", `boot: ${env.cluster}, ${env.dryRun ? "DRY RUN" : "live"}, actors ${[...actors].join(",")}`));

const sessions = createSessionService();
// S6 (session-lanes.md §3): halt-watch is the halt board's only writer; the events reader serves corporate actions and earnings.
const halts = createHaltBoard();
const events = createSessionEvents();
const deps = (actor: string, spot: VenueDeps["spot"] = null): VenueDeps => ({ env, log: log(actor), sessions, spot, halts, events });

// The relay owns the spot feed, so it starts first and hands the feed to the maker and the HTTP server.
const relay = actors.has("relay") ? await boot("price-relay", () => startPriceRelay(deps("price-relay"))) : null;
const spot = relay?.spot ?? null;
// S6 token lane (session-lanes.md §2.4): the Jupiter xStock spot runs only for the maker and HTTP, joined under the xStock
// symbols; halt-watch keeps the relay's own feed. Keyless lite-api (0.5 RPS) serves the 5 s poll when no key is set.
let marketSpot: SpotFeed | null = spot;
let prestocksSpot: PreStocksSpotHandle | null = null;
if (actors.has("maker") || actors.has("http")) {
  if (!process.env.JUPITER_API_KEY) log("xstock-spot")("JUPITER_API_KEY not set: polling keyless lite-api.jup.ag; the token maker pulls while Jupiter fails");
  const xstockSpot = createXStockSpotFeed({ log: log("xstock-spot"), apiKey: process.env.JUPITER_API_KEY || undefined });
  xstockSpot.start();
  // Plan Step 1 (D-100): the PreStocks catalogue prices the pre-IPO names for the holdings card, the maker and /prestocks/latest.
  prestocksSpot = createPreStocksSpotFeed({ log: log("prestocks-spot") });
  prestocksSpot.start();
  log("prestocks-spot")(`polling the PreStocks catalogue every ${PRESTOCKS_SPOT_EVERY_MS / 1000} s for ${prestocksSpot.symbols().join(",")}`);
  marketSpot = joinPreStocksSpot(joinXStockSpot(spot, xstockSpot), prestocksSpot);
}
if (actors.has("http")) void boot("http", () => startOpsHttp({ port: env.httpPort, spot: marketSpot, prestocks: prestocksSpot, sessions, halts, events, env, log: log("http") }));
if (actors.has("halts")) void boot("halt-watch", () => startHaltWatch(deps("halt-watch", spot)));
if (actors.has("earnings")) void boot("earnings", () => startEarnings(deps("earnings")));
if (actors.has("roller")) void boot("window-roller", () => startWindowRoller(deps("window-roller")));
if (actors.has("settler")) void boot("settler", () => startSettler(deps("settler")));
if (actors.has("indexer")) void boot("indexer", () => startIndexer(deps("indexer")));
if (actors.has("maker")) {
  if (process.env.MAKER_MODE === "vault") void boot("market-maker", () => startMarketMaker(log("market-maker")));
  else void boot("seed-maker", () => startSeedMaker(deps("seed-maker", marketSpot)));
}

if (actors.has("strategy-runner")) void startStrategyRunner(log("strategy-runner"));
if (actors.has("x-relay")) void startXRelay(log("x-relay"));
if (actors.has("leverage-keeper")) void startLeverageKeeper(log("leverage-keeper"));
// The projector feeds the room it is given, so the room starts first and hands its context over. Named on its own it
// still runs: the rows it writes are the duel history, and the room is only where live deltas go.
if (actors.has("game-room")) void startGameRoom(log("game-room")).then((room) => startDuelProjector(log("duel-projector"), room));
else if (actors.has("duel-projector")) void startDuelProjector(log("duel-projector"), null);
if (actors.has("duel-settler")) void startDuelSettler(log("duel-settler"));
setInterval(() => {
  const stuck = heartbeats().filter((b) => b.passStartedMs !== null && Date.now() - b.passStartedMs > STUCK_PASS_MS);
  if (stuck.length === 0) return console.log(whyString("ops", "idle heartbeat"));
  // Crash-only recovery: every actor reconciles from chain state on boot, so a restart is always safe.
  console.log(whyString("ops", `exiting: pass stuck over ${STUCK_PASS_MS / 60_000} min in ${stuck.map((b) => b.actor).join(", ")}`));
  process.exit(70);
}, HEARTBEAT_MS);
