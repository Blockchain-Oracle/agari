/**
 * desk-runner (S21 C4, plan §8): the actor that looks after every desk on this cluster. A 60 s tick; per desk, a
 * wake when its top of the hour is unclaimed or an event fired (money arrived, a held name moved 3 % within the hour,
 * the owner pressed Check now); the daily checkpoint at 00:05 UTC for live desks; grades for records a day old; and
 * the hourly PreStocks marks for all eight names. One operator key, one sender, one desk at a time. The runner reads
 * the process's PreStocks feed and never fetches the catalogue itself.
 */
import { missingDeskCredentialHint, resolveDeskModel } from "@agari/brain";
import { PRE_IPO_SYMBOLS } from "@agari/core/market";
import { deskQueries, getDb, type DeskRow, type WakeTrigger } from "@agari/db";
import { keypairSigner } from "@agari/markets/deploy";
import { createDeskOperatorClient, createDeskRpc } from "@agari/markets/desk";
import { CLUSTER_ID } from "@agari/core/constants";
import type { PreStocksSpotFeed } from "../../prices/prestocks-spot";
import { runActor, type Log } from "../../runtime/actor";
import { errorText, redact } from "../../runtime/env";
import { daySlotSec, inCheckpointWindow } from "./checkpoint";
import { callsThisHour, warmCallBudget } from "./decide";
import { discoverDesks } from "./discover";
import { readDeskRunnerEnv, type DeskRunnerEnv } from "./env";
import { gradeDue } from "./grade";
import { hourSlotSec, recordMarks } from "./marks";
import type { RunnerContext, WakeReport } from "./types";
import { feedWarm, heldMoveBps, MOVE_WAKE_BPS, refreshMints } from "./value";
import { wakeDesk } from "./wake";

export interface DeskRunnerDeps {
  log: Log;
  /** The in-process PreStocks feed (`main.ts` starts it before this actor). */
  prestocks: PreStocksSpotFeed | null;
  env?: DeskRunnerEnv;
}

/** The runner's context from its environment: the queries, the RPC, the operator client when there is a key, the brain. */
export async function createRunnerContext(deps: DeskRunnerDeps): Promise<RunnerContext | null> {
  const env = deps.env ?? readDeskRunnerEnv();
  const db = getDb();
  if (!db) {
    deps.log("DATABASE_URL is not set: the desk has no record to write; idle");
    return null;
  }
  if (!deps.prestocks) {
    deps.log("no PreStocks feed in this process (start with the http or maker actor); idle");
    return null;
  }
  const rpc = createDeskRpc(env.rpcUrl);
  const operator = env.operatorSecret && !env.dryRun ? await createDeskOperatorClient({ secretKey: env.operatorSecret, rpcUrl: env.rpcUrl, clusterTag: CLUSTER_ID[env.cluster] }) : null;
  const attestor = env.attestorSecret ? await keypairSigner(env.attestorSecret) : null;
  const brain = resolveDeskModel();
  const ctx: RunnerContext = { env, q: deskQueries(db), feed: deps.prestocks, rpc, operator, attestor, brain, brainMissing: missingDeskCredentialHint(), callsAtMs: [], mints: null, holding: new Set(), log: deps.log };
  deps.log(`desk runner on ${env.cluster} via ${redact(env.rpcUrl).replace(/api-key=.*$/, "api-key=<HELIUS_API_KEY>")}${operator ? `, operator ${operator.address}` : env.operatorSecret ? " (DRY RUN: the operator key is not used)" : " (no DESK_RUNNER_PRIVATE_KEY: practice desks only; live desks are read and recorded, never traded)"}${attestor ? "" : "; no PRICE_ATTESTOR_PRIVATE_KEY, references are never refreshed here"}`);
  deps.log(brain ? `desk brain: ${brain.providerName}/${brain.modelId} via ${brain.via}` : `desk brain not configured: set ${ctx.brainMissing}`);
  return ctx;
}

const isPractice = (d: DeskRow) => d.mode === "practice" || !d.address;

/** Everything that may wake one desk this tick, in order: a check-now request, the hour, money, a move. */
async function wakesDue(ctx: RunnerContext, desk: DeskRow, nowSec: number): Promise<{ trigger: WakeTrigger; scheduledForSec: number; wakeId: string | null }[]> {
  const due: { trigger: WakeTrigger; scheduledForSec: number; wakeId: string | null }[] = [];
  const requested = await ctx.q.takeRequestedWake({ deskId: desk.id, nowSec });
  if (requested) due.push({ trigger: requested.trigger, scheduledForSec: requested.scheduledForSec, wakeId: requested.id });
  const hourSec = hourSlotSec(nowSec);
  const hour = await ctx.q.claimWake({ deskId: desk.id, scheduledForSec: hourSec, trigger: "hour", nowSec });
  if (hour) due.push({ trigger: "hour", scheduledForSec: hourSec, wakeId: hour.id });
  const snapshot = await ctx.q.latestSnapshot(desk.id);
  if (snapshot) {
    const positions = Object.fromEntries(snapshot.holdings.map((h) => [h.symbol, BigInt(h.raw)]));
    const move = heldMoveBps(ctx.feed, positions, nowSec);
    if (move && Math.abs(move.bps) >= MOVE_WAKE_BPS) {
      const claimed = await ctx.q.claimWake({ deskId: desk.id, scheduledForSec: hourSec, trigger: "move", nowSec });
      if (claimed) due.push({ trigger: "move", scheduledForSec: nowSec, wakeId: claimed.id });
    }
    // Money arriving is seen cheaply for a practice desk (its ledger); a live desk's balance is read inside its wake.
    if (isPractice(desk)) {
      const paper = await ctx.q.getPaper(desk.id);
      if (paper && paper.updatedAtSec > snapshot.takenAtSec && BigInt(paper.cashE6) > BigInt(snapshot.usdcE6)) {
        const claimed = await ctx.q.claimWake({ deskId: desk.id, scheduledForSec: hourSec, trigger: "deposit", nowSec });
        if (claimed) due.push({ trigger: "deposit", scheduledForSec: nowSec, wakeId: claimed.id });
      }
    }
  }
  return due;
}

export async function startDeskRunner(deps: DeskRunnerDeps): Promise<{ stop: () => void }> {
  const ctx = await createRunnerContext(deps);
  const env = deps.env ?? readDeskRunnerEnv();
  let warmed = false;
  let lastWake: { deskId: string; trigger: string; atSec: number; status: string } | null = null;
  const { stop } = runActor({
    name: "desk-runner",
    log: deps.log,
    dryRun: env.dryRun,
    everyMs: env.intervalMs,
    pass: async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      if (!ctx) return { why: "not configured; idle", detail: { desks: 0, practice: 0, live: 0, lastWake: null, modelCallsThisHour: 0, unresolved: 0, dryRun: env.dryRun } };
      if (!warmed) {
        const made = await warmCallBudget(ctx, Date.now());
        deps.log(`call budget: ${made} made in the last hour, ${env.maxModelCallsPerHour} an hour allowed, ${env.modelTimeoutMs} ms per call`);
        warmed = true;
      }
      await refreshMints(ctx, nowSec);
      const marks = await recordMarks(ctx, nowSec);
      const { desks, found } = await discoverDesks(ctx, nowSec);
      const practice = desks.filter(isPractice).length;
      const notes: string[] = [];
      if (found) notes.push(`${found} desk(s) discovered on chain`);
      if (marks) notes.push(`${marks} marks written for ${new Date(hourSlotSec(nowSec) * 1000).toISOString().slice(11, 16)}`);
      const warm = feedWarm(ctx.feed, PRE_IPO_SYMBOLS, nowSec);
      if (!warm) notes.push("feed warming: fewer than three PreStocks reads in the half hour, wakes wait");
      let wakes = 0;
      let graded = 0;
      for (const desk of desks) {
        const live = !isPractice(desk);
        try {
          if (warm) {
            for (const due of await wakesDue(ctx, desk, nowSec)) {
              // A live desk in a dry run is read, valued and asked exactly as a real check, and nothing is written or sent.
              const report: WakeReport = await wakeDesk(ctx, { desk, trigger: due.trigger, scheduledForSec: due.scheduledForSec, wakeId: due.wakeId, dry: live && env.dryRun });
              wakes += 1;
              lastWake = { deskId: desk.id, trigger: due.trigger, atSec: nowSec, status: report.status };
              notes.push(`${desk.id.slice(0, 8)} ${due.trigger}: ${report.status}${report.note ? ` (${report.note})` : ""}, ${report.records.map((r) => r.outcome).join(",") || "no record"}`);
            }
            if (live && inCheckpointWindow(nowSec) && !env.dryRun && ctx.operator) {
              const claimed = await ctx.q.claimWake({ deskId: desk.id, scheduledForSec: daySlotSec(nowSec), trigger: "checkpoint", nowSec });
              if (claimed) {
                const report = await wakeDesk(ctx, { desk, trigger: "checkpoint", scheduledForSec: daySlotSec(nowSec), wakeId: claimed.id });
                notes.push(`${desk.id.slice(0, 8)} checkpoint: ${report.status}`);
              }
            }
          }
          graded += await gradeDue(ctx, desk, nowSec);
        } catch (error) {
          notes.push(`${desk.id.slice(0, 8)}: ${errorText(error)}`);
        }
      }
      const detail = { desks: desks.length, practice, live: desks.length - practice, lastWake, modelCallsThisHour: callsThisHour(ctx, Date.now()), unresolved: ctx.holding.size, dryRun: env.dryRun };
      const why = `${desks.length} desk(s) (${practice} practice, ${desks.length - practice} live); ${wakes} wake(s), ${graded} graded, ${detail.modelCallsThisHour}/${env.maxModelCallsPerHour} model calls this hour${ctx.holding.size ? `, ${ctx.holding.size} holding` : ""}${notes.length ? `: ${notes.join("; ")}` : ""}`;
      return { why, detail };
    },
  });
  return { stop };
}
