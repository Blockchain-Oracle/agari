// recount --source chain: an independent walk of agari-events (every program signature back past the board's scope,
// each transaction fetched and decoded afresh, Series grids read from their accounts). Nothing comes from the database.
//
// Where the walk stops: every Window that can count has expiry ≥ from (so it opened after from − 1 h − the roller's
// lead) or resolved inside the window (so its `WindowOpened` must be found). Walking stops once both hold, or at the
// board's lookback, whichever comes first; a Window's fills and complete sets all follow its `WindowOpened`.

import { AGARI_EVENTS_PROGRAM_ID, createIndexerRpc, decodeTransactionEvents, eventAuthorityOf, type SignatureInfo } from "@agari/markets/ops/indexer";
import { absorb, RECOUNT_EVENTS, type Tape } from "./facts";

export interface ChainScope {
  rpcUrl: string;
  rps: number;
  fromSec: number;
  toSec: number;
  lookbackSec: number;
  log: (line: string) => void;
}

const LONGEST_CADENCE_SEC = 3_600;
/** A Window opens up to ≈ 2 min before trading starts (measured 09-14: −117 s); 15 min covers it with room. */
const OPEN_LEAD_SEC = 900;
/** Block time and the program's clock differ by seconds; nothing after the window's end can count. */
const CLOCK_SKEW_SEC = 60;
const SIGNATURE_PAGE = 1_000;
const NAMES = new Set<string>(RECOUNT_EVENTS);

async function signaturesSince(rpc: Awaited<ReturnType<typeof createIndexerRpc>>, floorSec: number): Promise<SignatureInfo[]> {
  const out: SignatureInfo[] = [];
  let before: string | undefined;
  for (;;) {
    const page = await rpc.signaturesPage(AGARI_EVENTS_PROGRAM_ID, before ? { before } : {});
    for (const row of page) {
      if (row.blockTimeSec !== null && row.blockTimeSec < floorSec) return out;
      out.push(row);
    }
    if (page.length < SIGNATURE_PAGE) return out;
    before = page[page.length - 1]!.signature;
  }
}

export async function chainTape(scope: ChainScope): Promise<Tape> {
  const rpc = await createIndexerRpc({ rpcUrl: scope.rpcUrl, rpcSubscriptionsUrl: scope.rpcUrl.replace(/^http/, "ws"), rps: scope.rps });
  const authority = await eventAuthorityOf();
  const floorSec = scope.lookbackSec - OPEN_LEAD_SEC;
  const earlyStopSec = Math.max(floorSec, scope.fromSec - LONGEST_CADENCE_SEC - OPEN_LEAD_SEC);
  const sigs = await signaturesSince(rpc, floorSec);
  scope.log(`chain: ${sigs.length} program signatures since ${new Date(floorSec * 1000).toISOString()} (newest first); fetching…`);

  const tape: Tape = { windows: new Map(), fills: [], sets: [], grids: new Map(), notes: [], problems: [] };
  let fetched = 0;
  let stoppedAt: SignatureInfo | null = null;
  for (const info of sigs) {
    if (info.blockTimeSec !== null && info.blockTimeSec < earlyStopSec) {
      // Resolved inside the window but not yet seen opening: keep walking toward the lookback.
      const waiting = [...tape.windows.values()].some((w) => w.tradingStartSec < 0 && w.resolved && w.resolved.resolvedTsSec >= scope.fromSec && w.resolved.resolvedTsSec < scope.toSec);
      if (!waiting) {
        stoppedAt = info;
        break;
      }
    }
    if (info.failed || (info.blockTimeSec !== null && info.blockTimeSec > scope.toSec + CLOCK_SKEW_SEC)) continue;
    const raw = await rpc.transaction(info.signature);
    fetched += 1;
    if (!raw) {
      tape.problems.push(`transaction ${info.signature} unavailable from the RPC`);
      continue;
    }
    for (const event of decodeTransactionEvents(raw, AGARI_EVENTS_PROGRAM_ID, authority).events) {
      if (NAMES.has(event.name)) absorb(tape, { ...event, data: event.data as Record<string, unknown> });
    }
    if (fetched % 200 === 0) scope.log(`  decoded ${fetched} transactions (at ${info.blockTimeSec === null ? "?" : new Date(info.blockTimeSec * 1000).toISOString()})`);
  }

  const series = [...new Set([...tape.windows.values()].map((w) => w.series).filter(Boolean))];
  const infos = await rpc.seriesInfo(series);
  infos.forEach((s, i) => {
    if (s) tape.grids.set(series[i]!, { symbol: s.symbol, cadenceSec: s.cadenceSec, lotBase: BigInt(s.lotBase), tickBase: BigInt(s.tickBase) });
    else tape.problems.push(`Series ${series[i]} not found on chain`);
  });
  tape.notes.push(
    `chain: ${fetched} transactions decoded of ${sigs.length} signatures; walk stopped ${stoppedAt ? `at ${new Date((stoppedAt.blockTimeSec ?? 0) * 1000).toISOString()} (scope fully covered)` : "at the lookback"}; ${series.length} Series read`,
  );
  return tape;
}
