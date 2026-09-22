/**
 * Which desks this runner looks after: every row in the database on this cluster, plus every `Desk` account on
 * chain that names the operator key and the database has not seen (opened from the studio while ops was down, or
 * after a database reset). A discovered desk gets a row with no mandate; it is checked, valued and recorded, and
 * trades only once the owner's signed mandate arrives through the web.
 */
import type { DeskRow } from "@agari/db";
import { listDesksByOperator } from "@agari/markets/desk";
import { errorText } from "../../runtime/env";
import type { RunnerContext } from "./types";

const DISCOVER_EVERY_SEC = 10 * 60;
let discoveredAtSec = 0;

/** The desks to run this pass, discovery included every ten minutes when the runner has a key to be found by. */
export async function discoverDesks(ctx: RunnerContext, nowSec: number): Promise<{ desks: DeskRow[]; found: number }> {
  let found = 0;
  if (ctx.rpc && ctx.operator && nowSec - discoveredAtSec >= DISCOVER_EVERY_SEC) {
    try {
      const known = await ctx.q.listDesks({ cluster: ctx.env.cluster });
      for (const d of await listDesksByOperator(ctx.rpc, ctx.operator.address)) {
        const row = known.find((k) => k.owner === (d.owner as string));
        if (row?.address === (d.address as string)) continue;
        await ctx.q.registerLiveDesk({ owner: d.owner, cluster: ctx.env.cluster, address: d.address, operator: ctx.operator.address, mode: d.mode === "practice" ? "ask_first" : d.mode, nowSec });
        found += 1;
        ctx.log(`discovered desk ${d.address} of ${d.owner} (${d.mode}, seq ${d.seq})`);
      }
      discoveredAtSec = nowSec;
    } catch (error) {
      ctx.log(`discovery failed: ${errorText(error)}`);
    }
  }
  const desks = (await ctx.q.listDesks({ cluster: ctx.env.cluster })).filter((d) => d.state !== "closed");
  return { desks, found };
}
