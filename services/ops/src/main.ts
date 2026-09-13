/**
 * The single long-running ops service (AD-8). Each actor is a single writer over its own key and
 * registers here; every cycle logs a structured why-string, and idle is a heartbeat, never silence.
 */
import { startDuelProjector } from "./actors/duel-projector";
import { startDuelSettler } from "./actors/duel-settler";
import { startGameRoom } from "./actors/game-room";
import { startLeverageKeeper } from "./actors/leverage-keeper";
import { startMarketMaker } from "./actors/market-maker";
import { startStrategyRunner } from "./actors/strategy-runner";
import { startXRelay } from "./actors/x-relay";

const HEARTBEAT_MS = 30_000;

function whyString(actor: string, why: string): string {
  return JSON.stringify({ tsMs: Date.now(), actor, why });
}

const log = (actor: string) => (why: string) => console.log(whyString(actor, why));

console.log(whyString("ops", "boot"));
void startStrategyRunner(log("strategy-runner"));
void startXRelay(log("x-relay"));
void startMarketMaker(log("market-maker"));
void startLeverageKeeper(log("leverage-keeper"));
// The projector feeds the room it is given, so the room starts first and hands its context over.
void startGameRoom(log("game-room")).then((room) => startDuelProjector(log("duel-projector"), room));
void startDuelSettler(log("duel-settler"));
setInterval(() => console.log(whyString("ops", "idle heartbeat")), HEARTBEAT_MS);
