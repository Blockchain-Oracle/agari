/**
 * The chain indexer (plan §4 indexer; venue-ops.md §9): the live logs subscription plus a cursor walk every
 * `INDEXER_WALK_MS` that promotes finalized rows, advances the cursor, removes dropped transactions and fills `seq`
 * holes. Read-only on chain (no key); it never signs, so DRY_RUN doesn't change what it does.
 */
import { existsSync, readFileSync } from "node:fs";
import { ensureSchema, getDb, indexReader, indexWriter } from "@agari/db";
import { AGARI_EVENTS_PROGRAM_ID, createIndexerRpc, eventAuthorityOf } from "@agari/markets/ops/indexer";
import { runActor, type VenueDeps } from "../../runtime";
import { backfillOnce } from "./backfill";
import { runSubscription } from "./subscribe";
import type { IndexerContext } from "./decode";

const DEFAULT_WALK_MS = 20_000;
const DEFAULT_RPS = 3;

/** The walk's floor: `INDEXER_START_SLOT`, else the deploy slot in `scripts/deploy/addresses.devnet.json`, else 0. */
function startSlotFrom(env: NodeJS.ProcessEnv): number {
  const configured = Number(env.INDEXER_START_SLOT);
  if (Number.isInteger(configured) && configured >= 0 && env.INDEXER_START_SLOT) return configured;
  const file = new URL("../../../../../scripts/deploy/addresses.devnet.json", import.meta.url);
  if (!existsSync(file)) return 0;
  const record = JSON.parse(readFileSync(file, "utf8")) as { programs?: { agari_events?: { deployedSlot?: number } } };
  return record.programs?.agari_events?.deployedSlot ?? 0;
}

/** Builds the indexer's context; null (with a logged reason) when there is no database. */
export async function createIndexer(deps: VenueDeps, env: NodeJS.ProcessEnv = process.env): Promise<IndexerContext | null> {
  const db = getDb();
  if (!db) {
    deps.log("DATABASE_URL is not set: the indexer has nowhere to write; idle");
    return null;
  }
  await ensureSchema();
  const rps = Number(env.INDEXER_RPS);
  const rpc = await createIndexerRpc({
    rpcUrl: deps.env.rpcUrl,
    rpcSubscriptionsUrl: deps.env.rpcSubscriptionsUrl,
    rps: Number.isFinite(rps) && rps > 0 ? rps : DEFAULT_RPS,
  });
  return {
    rpc,
    writer: indexWriter(db),
    programId: AGARI_EVENTS_PROGRAM_ID,
    eventAuthority: await eventAuthorityOf(),
    startSlot: deps.env.cluster === "localnet" ? 0 : startSlotFrom(env),
    log: deps.log,
    stats: { txs: 0, events: 0, lastLagSec: null, maxLagSec: 0, subscription: "connecting", gapsFilled: 0, dropped: 0, rebuilt: 0 },
    seriesSeen: new Set(),
    gaps: new Map(),
  };
}

export async function startIndexer(deps: VenueDeps, env: NodeJS.ProcessEnv = process.env): Promise<{ stop: () => void } | null> {
  const ctx = await createIndexer(deps, env);
  if (!ctx) return null;
  const reader = indexReader(getDb()!);
  const abort = new AbortController();
  void runSubscription(ctx, abort.signal);
  const walkMs = Number(env.INDEXER_WALK_MS);
  const actor = runActor({
    name: "indexer",
    log: deps.log,
    dryRun: false,
    everyMs: Number.isFinite(walkMs) && walkMs >= 2_000 ? walkMs : DEFAULT_WALK_MS,
    pass: async () => {
      const walk = await backfillOnce(ctx);
      const status = await reader.status(ctx.programId);
      const lastBlock = Number(status.last_block_time_sec ?? 0);
      const detail = {
        subscription: ctx.stats.subscription,
        lastLagSec: ctx.stats.lastLagSec,
        maxLagSec: ctx.stats.maxLagSec,
        headAgeSec: lastBlock ? Math.round(Date.now() / 1000 - lastBlock) : null,
        txs: status.txs,
        confirmedTxs: status.confirmed_txs,
        events: status.events,
        fills: status.fills,
        windowsOpened: status.windows_opened,
        windowsResolved: status.windows_resolved,
        cursorSlot: walk.cursorSlot,
        finalizedSlot: walk.finalizedSlot,
        gapsOpen: ctx.gaps.size,
        gapsFilled: ctx.stats.gapsFilled,
        dropped: ctx.stats.dropped,
        rebuilt: ctx.stats.rebuilt,
      };
      const why = `${ctx.stats.subscription} · walk ${walk.walked} sigs (+${walk.fetched} new, ${walk.promoted} finalized${walk.dropped ? `, ${walk.dropped} dropped` : ""}${walk.complete ? "" : ", stopped early"}) · ${status.txs} txs ${status.events} events ${status.fills} fills · cursor ${walk.cursorSlot ?? "none"} · lag ${ctx.stats.lastLagSec ?? "-"} s${ctx.gaps.size ? ` · ${ctx.gaps.size} gap(s)` : ""}`;
      return { why, detail };
    },
  });
  return {
    stop: () => {
      abort.abort();
      actor.stop();
    },
  };
}
