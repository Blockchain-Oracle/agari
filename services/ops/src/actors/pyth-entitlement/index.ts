/**
 * pyth-entitlement (S20, D-125): the hourly per-feed probe of the venue's Pyth key against each valuation index,
 * ticking every 60 s and asking Hermes only for the feeds whose hour is up. Heartbeat detail = the store's snapshot,
 * so `/health` shows `OPENAI denied (403 pyth-indices)` beside the other actors. Started with `relay` or `roller`:
 * the relay refuses an unentitled index before fetching, the roller lists a valuation lane only while entitled.
 */
import { runActor } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { describeEntitlements, PROBE_EVERY_MS } from "../../runtime/pyth-entitlement";

const TICK_MS = 60_000;
/** Hermes REST pacing: a second between probes, as the boundary cache paces its own requests. */
const BETWEEN_PROBES_MS = 1_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startPythEntitlement(deps: VenueDeps): Promise<{ stop: () => void }> {
  const store = deps.pythIndex;
  if (!store.hasKey) deps.log("PYTH_API_KEY is not set: no valuation index is probed; every index stays unknown and nothing lists on it");
  const { stop } = runActor({
    name: "pyth-entitlement",
    log: deps.log,
    dryRun: false,
    everyMs: TICK_MS,
    pass: async () => {
      const due = store.due();
      for (const [i, feed] of due.entries()) {
        if (i > 0) await sleep(BETWEEN_PROBES_MS);
        await store.probe(feed.feedIdHex);
      }
      const probed = due.length ? `probed ${due.map((f) => f.symbol).join(",")} · ` : "";
      return { why: `${probed}${describeEntitlements(store)} · each feed probed every ${PROBE_EVERY_MS / 60_000} min`, detail: store.snapshot() };
    },
  });
  return { stop };
}
