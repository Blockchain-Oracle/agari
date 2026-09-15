/**
 * settler (plan §4; venue-ops.md §7): settles or voids every Window once its prints allow, then drains it — sweep,
 * redeem_for every public seat to its owner's ATA, release the Book, close the Ledger, and close Market + result
 * after retention. One writer (the `settler` key), reconcile before send, never resend blindly.
 */
import { chainNowSec, fetchMarkets, fetchSeries, listMarketsOfSeries, listSeries, MARKET_FLAG, seriesBasis, windowAddresses, type MarketView, type OpsClient, type SeriesView } from "@agari/markets/ops";
import { readBookOrderCount, readLedger, readVenueConfig, type LedgerState, type VenueConfig } from "@agari/markets/ops/settle";
import { runActor, type PassResult, type VenueDeps } from "../../runtime";
import { decideSettle } from "./decide";
import { execute } from "./execute";
import { roleClient } from "./role-client";
import { marketLabel, settleInput } from "./views";

/** D-032: seats stay claimable by their owners for this long after resolution before `redeem_for` pays them. */
const REDEEM_GRACE_SEC = Number.isFinite(Number(process.env.SETTLER_REDEEM_GRACE_SEC)) && process.env.SETTLER_REDEEM_GRACE_SEC ? Number(process.env.SETTLER_REDEEM_GRACE_SEC) : 300;

const PASS_MS = 5_000;
const SERIES_LIST_MS = 5 * 60_000;
const SERIES_POLL_MS = 30_000;
const CLOCK_CACHE_MS = 5_000;
/** Sends per pass, so a backlog (a restart after a busy session) stays inside the RPC budget. */
const MAX_SENDS_PER_PASS = 12;

type Tracked = { address: string; series: string; nextCheckSec: number; seen: boolean };

interface Settler {
  deps: VenueDeps;
  client: OpsClient;
  dryRun: boolean;
  allSeries: boolean;
  config: VenueConfig | null;
  series: Map<string, SeriesView>;
  nextIndex: Map<string, bigint>;
  tracked: Map<string, Tracked>;
  clock: { sec: number; atMs: number };
  listedAtMs: number;
  polledAtMs: number;
  counts: Record<string, number>;
}

/** Every registry ticker's Series of a known basis: settle and void rules are the same for Regular, Gap and token Windows (session-lanes.md §1.5, §2.4). */
const eligible = (s: SeriesView, all: boolean) => all || (s.symbol !== null && seriesBasis(s) !== null);

async function nowSec(st: Settler): Promise<number> {
  if (Date.now() - st.clock.atMs > CLOCK_CACHE_MS) st.clock = { sec: await chainNowSec(st.client), atMs: Date.now() };
  return st.clock.sec + Math.floor((Date.now() - st.clock.atMs) / 1000);
}

function track(st: Settler, series: string, address: string) {
  if (!st.tracked.has(address)) st.tracked.set(address, { address, series, nextCheckSec: 0, seen: false });
}

/** Boot and every 5 minutes: every eligible Series and its existing Markets; every 30 s: new Window indices. */
async function discover(st: Settler): Promise<void> {
  if (Date.now() - st.listedAtMs > SERIES_LIST_MS) {
    for (const s of await listSeries(st.client)) {
      if (!eligible(s, st.allSeries)) continue;
      if (!st.series.has(s.address)) {
        for (const m of await listMarketsOfSeries(st.client, s.address)) track(st, s.address, m.address);
        st.nextIndex.set(s.address, s.data.nextIndex);
      }
      st.series.set(s.address, s);
    }
    st.listedAtMs = st.polledAtMs = Date.now();
    return;
  }
  if (Date.now() - st.polledAtMs < SERIES_POLL_MS) return;
  st.polledAtMs = Date.now();
  const fresh = await fetchSeries(st.client, [...st.series.keys()] as never);
  for (const s of fresh) {
    if (!s) continue;
    st.series.set(s.address, s);
    for (let i = st.nextIndex.get(s.address) ?? s.data.nextIndex; i < s.data.nextIndex; i++) track(st, s.address, (await windowAddresses(s.address, i)).market);
    st.nextIndex.set(s.address, s.data.nextIndex);
  }
}

async function tend(st: Settler, m: MarketView, now: number, budget: { sends: number }): Promise<{ note: string | null; nextCheckSec: number }> {
  const series = st.series.get(m.data.series)!;
  const label = marketLabel(series, m);
  const terminal = m.data.state !== 0;
  const bookOrderCount = terminal && (m.data.flags & MARKET_FLAG.bookReleased) === 0 ? await readBookOrderCount(st.client, m.data.book) : null;
  let ledger: LedgerState | null | undefined;
  if (terminal && (m.data.flags & MARKET_FLAG.ledgerClosed) === 0) ledger = await readLedger(st.client, m.data.ledger);
  const action = decideSettle(settleInput(m, series, { nowSec: now, retentionSec: st.config!.retentionSec, redeemGraceSec: REDEEM_GRACE_SEC, bookOrderCount, ledger }));
  if (action.kind === "wait") return { note: null, nextCheckSec: action.untilSec };
  if (action.kind === "read") return { note: `${label}: ${action.why} unreadable`, nextCheckSec: now + 30 };
  if (budget.sends <= 0) return { note: null, nextCheckSec: now };
  budget.sends -= 1;
  const checkAdmissionSec = series.data.policyVersions[m.data.policyVersion]?.checkAdmissionSec ?? 0;
  const outcome = await execute({ client: st.client, dryRun: st.dryRun, nowSec: now, config: st.config!, checkAdmissionSec, label }, action, m, ledger);
  if (outcome.sent) st.counts[action.kind] = (st.counts[action.kind] ?? 0) + 1;
  return { note: outcome.note, nextCheckSec: outcome.nextCheckSec };
}

async function pass(st: Settler): Promise<PassResult> {
  st.config ??= await readVenueConfig(st.client);
  await discover(st);
  const now = await nowSec(st);
  const due = [...st.tracked.values()].filter((t) => t.nextCheckSec <= now);
  const views = await fetchMarkets(st.client, due.map((t) => t.address) as never);
  const budget = { sends: MAX_SENDS_PER_PASS };
  for (const [i, t] of due.entries()) {
    const view = views[i];
    if (!view) {
      // Closed (or a stale index that never opened): nothing left to do.
      if (t.seen) st.counts.closedGone = (st.counts.closedGone ?? 0) + 1;
      st.tracked.delete(t.address);
      continue;
    }
    t.seen = true;
    try {
      const { note, nextCheckSec } = await tend(st, view, now, budget);
      t.nextCheckSec = nextCheckSec;
      if (note) st.deps.log(note);
    } catch (error) {
      t.nextCheckSec = now + 30;
      st.deps.log(`${marketLabel(st.series.get(t.series), view)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const waiting = [...st.tracked.values()].map((t) => t.nextCheckSec).filter((s) => s > now);
  const next = waiting.length ? Math.min(...waiting) : null;
  const counts = Object.entries(st.counts).map(([k, v]) => `${k} ${v}`).join(", ") || "nothing sent yet";
  return {
    why: `${st.tracked.size} Windows tracked over ${st.series.size} Series; ${due.length} due; ${counts}${next ? `; next due ${new Date(next * 1000).toISOString().slice(11, 19)}Z` : ""}${st.dryRun ? " · DRY RUN" : ""}`,
    detail: { tracked: st.tracked.size, series: st.series.size, counts: { ...st.counts }, nextDueSec: next },
    nextDelayMs: budget.sends <= 0 ? 500 : PASS_MS,
  };
}

export async function startSettler(deps: VenueDeps): Promise<{ stop: () => void }> {
  const { client, signing } = await roleClient(deps.env, "settler");
  if (!signing) deps.log("SETTLER_PRIVATE_KEY and ~/.config/agari/devnet/settler.json are missing: scanning and reporting only");
  else deps.log(`settler key ${client.payer.address}`);
  const st: Settler = {
    deps, client, dryRun: deps.env.dryRun || !signing, allSeries: process.env.SETTLER_ALL_SERIES === "1",
    config: null, series: new Map(), nextIndex: new Map(), tracked: new Map(), clock: { sec: 0, atMs: 0 }, listedAtMs: 0, polledAtMs: 0, counts: {},
  };
  const { stop } = runActor({ name: "settler", log: deps.log, dryRun: st.dryRun, everyMs: PASS_MS, pass: () => pass(st) });
  return { stop };
}
