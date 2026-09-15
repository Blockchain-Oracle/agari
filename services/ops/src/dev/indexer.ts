// Dev runner for the indexer alone (venue-ops.md §2.5).
//   pnpm --filter @agari/ops exec tsx --env-file-if-exists=../../.env.local src/dev/indexer.ts [--rebuild] [--once]
// --rebuild truncates every idx_ table first (plan §4 indexer step 9); --once runs one cursor walk and exits.
// Env: DATABASE_URL, SOLANA_CLUSTER (+ SURFPOOL_PORT/SURFPOOL_WS_PORT on localnet) or HELIUS_API_KEY, INDEXER_RPS, INDEXER_WALK_MS.
import { getDb, indexReader, indexWriter } from "@agari/db";
import { createSessionService } from "../calendar/session-service";
import { backfillOnce } from "../actors/indexer/backfill";
import { createIndexer, startIndexer } from "../actors/indexer";
import { createHaltBoard, createSessionEvents, readOpsEnv, redact } from "../runtime";

const env = readOpsEnv();
const log = (why: string) => console.log(JSON.stringify({ tsMs: Date.now(), actor: "indexer", why: redact(why) }));
const deps = { env, log, sessions: createSessionService(), spot: null, halts: createHaltBoard(), events: createSessionEvents() };

if (process.argv.includes("--rebuild")) {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not set");
  await indexWriter(db).truncate().catch(() => undefined);
  log("truncated every idx_ table: full rebuild from the start slot");
}

if (process.argv.includes("--once")) {
  const ctx = await createIndexer(deps);
  if (!ctx) process.exit(1);
  const started = Date.now();
  const walk = await backfillOnce(ctx);
  const status = await indexReader(getDb()!).status(ctx.programId);
  log(`one walk in ${((Date.now() - started) / 1000).toFixed(1)} s: ${JSON.stringify(walk)}`);
  console.log(JSON.stringify(status, null, 2));
  await getDb()!.end();
  process.exit(0);
}

await startIndexer(deps);
