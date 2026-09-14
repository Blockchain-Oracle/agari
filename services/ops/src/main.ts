/**
 * The single long-running ops service (AD-8). Each actor is a single writer over its own key and
 * registers here; every cycle logs a structured why-string, and idle is a heartbeat, never silence.
 *
 * S3 venue actors (venue-ops.md §2.5) share one session calendar and price-relay's spot feed. `OPS_ACTORS` names
 * what runs: the default is the venue set; `all` adds the Masayume-era actors, which idle until their stages deploy
 * the programs they drive. DRY_RUN stays on unless `DRY_RUN=0` (nothing signs by default).
 */
import { startDuelProjector } from "./actors/duel-projector";
import { startDuelSettler } from "./actors/duel-settler";
import { startGameRoom } from "./actors/game-room";
import { startIndexer } from "./actors/indexer";
import { startLeverageKeeper } from "./actors/leverage-keeper";
import { startMarketMaker } from "./actors/market-maker";
import { startSeedMaker } from "./actors/market-maker/seat";
import { startPriceRelay } from "./actors/price-relay";
import { startSettler } from "./actors/settler";
import { startStrategyRunner } from "./actors/strategy-runner";
import { startWindowRoller } from "./actors/window-roller";
import { startXRelay } from "./actors/x-relay";
import { createSessionService } from "./calendar/session-service";
import { startOpsHttp } from "./http/server";
import { errorText, readOpsEnv, redact, type VenueDeps } from "./runtime";

const HEARTBEAT_MS = 30_000;
const VENUE_ACTORS = ["relay", "roller", "settler", "maker", "indexer", "http"] as const;
const LEGACY_ACTORS = ["strategy-runner", "x-relay", "leverage-keeper", "game-room", "duel-settler"] as const;

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

/** Starts one actor, logging (never throwing) when it fails to boot, so one bad actor can't stop the others. */
function boot<T>(actor: string, start: () => Promise<T>): Promise<T | null> {
  return start().catch((error: unknown) => {
    log(actor)(`failed to start: ${errorText(error)}`);
    return null;
  });
}

const env = readOpsEnv();
const actors = selectedActors(process.env.OPS_ACTORS);
console.log(whyString("ops", `boot: ${env.cluster}, ${env.dryRun ? "DRY RUN" : "live"}, actors ${[...actors].join(",")}`));

const sessions = createSessionService();
const deps = (actor: string, spot: VenueDeps["spot"] = null): VenueDeps => ({ env, log: log(actor), sessions, spot });

// The relay owns the spot feed, so it starts first and hands the feed to the maker and the HTTP server.
const relay = actors.has("relay") ? await boot("price-relay", () => startPriceRelay(deps("price-relay"))) : null;
const spot = relay?.spot ?? null;
if (actors.has("http")) void boot("http", () => startOpsHttp({ port: env.httpPort, spot, env, log: log("http") }));
if (actors.has("roller")) void boot("window-roller", () => startWindowRoller(deps("window-roller")));
if (actors.has("settler")) void boot("settler", () => startSettler(deps("settler")));
if (actors.has("indexer")) void boot("indexer", () => startIndexer(deps("indexer")));
if (actors.has("maker")) {
  if (process.env.MAKER_MODE === "vault") void boot("market-maker", () => startMarketMaker(log("market-maker")));
  else void boot("seed-maker", () => startSeedMaker(deps("seed-maker", spot)));
}

if (actors.has("strategy-runner")) void startStrategyRunner(log("strategy-runner"));
if (actors.has("x-relay")) void startXRelay(log("x-relay"));
if (actors.has("leverage-keeper")) void startLeverageKeeper(log("leverage-keeper"));
// The projector feeds the room it is given, so the room starts first and hands its context over.
if (actors.has("game-room")) void startGameRoom(log("game-room")).then((room) => startDuelProjector(log("duel-projector"), room));
if (actors.has("duel-settler")) void startDuelSettler(log("duel-settler"));
setInterval(() => console.log(whyString("ops", "idle heartbeat")), HEARTBEAT_MS);
