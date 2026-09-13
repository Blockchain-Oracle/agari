/**
 * The strategy runner on its own: the entry point for a creator who hosts their bot. The same
 * actor the house runs, over the key `RUNNER_PRIVATE_KEY` names, for the strategies in
 * `STRATEGY_IDS` — nothing else of the ops service starts. See "Run your own bot" in the studio.
 */
import { startStrategyRunner } from "./actors/strategy-runner";

const HEARTBEAT_MS = 30_000;

function whyString(actor: string, why: string): string {
  return JSON.stringify({ tsMs: Date.now(), actor, why });
}

console.log(whyString("runner", "boot"));
void startStrategyRunner((why) => console.log(whyString("strategy-runner", why)));
setInterval(() => console.log(whyString("runner", "idle heartbeat")), HEARTBEAT_MS);
