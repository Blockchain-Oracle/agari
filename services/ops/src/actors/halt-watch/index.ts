/**
 * halt-watch (session-lanes.md §3.1): Pyth confidence and staleness, RedStone staleness, the xStocks issuer flag and
 * token-quote failures → the process's halt board. It never signs. Lane 6c owns `actors/halt-watch/**`; this foundation
 * stub registers the actor and writes nothing, so no lane is halted.
 */
import { runActor, type VenueDeps } from "../../runtime";

const PASS_MS = 60_000;

export async function startHaltWatch(deps: VenueDeps): Promise<{ stop: () => void }> {
  const { stop } = runActor({
    name: "halt-watch",
    log: deps.log,
    dryRun: false,
    everyMs: PASS_MS,
    pass: async () => ({ why: "paused: lane not built (6c)", detail: { halts: deps.halts.board() } }),
  });
  return { stop };
}
