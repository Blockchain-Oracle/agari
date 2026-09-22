import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import { getDb } from "@agari/db";
import type { MarketsEnv } from "@agari/markets";
import { SESSION_OPEN_STATES } from "./grade";
import { readOpsHealth, readOpsSession, type OpsRead, type OpsSession } from "./ops.server";
import { probeIndex, relayCounters } from "./probes-index.server";
import { heartbeatRows, indexerRow, lanesRow, pythIndexRow, pythTrialRow } from "./probes-ops.server";
import { PRICE_ASSETS_CAP, probeFaucet, probePrice, probeRpc, probeSensei, probeStore, sponsorRow, switchboardRow } from "./probes.server";
import { countsTowardOverall, HEALTHY_LAG_SEC, type StatusPayload, type StatusPipeline } from "./protocol";
import type { PrintScope } from "./rows-prints";

/**
 * One `/status` run (proof-analytics.md §2.5, §3): ops `/health` and `/session` are read once and shared, the chain head
 * once, the index in parallel. Concurrent requests share the run in flight, and a finished run answers for 10 s, so
 * however many tabs poll, the probes cost at most six runs a minute; `checkedAtMs` always says when it was measured.
 */
const RUN_REUSE_MS = 10_000;

let inFlight: Promise<StatusPayload> | null = null;
let lastRun: { atMs: number; payload: StatusPayload } | null = null;

/** In session unless ops says otherwise: with no session answer every row is judged as if the market were open. */
function sessionView(session: OpsRead<OpsSession>) {
  if (!session.ok) return { inSession: true, payload: null };
  const state = session.value.status?.state ?? null;
  const inSession = state === null || SESSION_OPEN_STATES.includes(state);
  return { inSession, payload: state === null ? null : { open: inSession, label: session.value.label } };
}

/** Up to four tickers with a roller lane, open ones first, in registry order. */
function priceAssets(session: OpsRead<OpsSession>): TickerSymbol[] {
  if (!session.ok) return [];
  const entries = Object.entries(session.value.lanes);
  const symbolOf = (key: string) => key.slice(0, key.lastIndexOf("-"));
  const open = new Set(entries.filter(([, state]) => state.startsWith("open #")).map(([key]) => symbolOf(key)));
  const listed = new Set(entries.map(([key]) => symbolOf(key)));
  const pick = open.size > 0 ? open : listed;
  return TICKER_SYMBOLS.filter((symbol) => pick.has(symbol)).slice(0, PRICE_ASSETS_CAP);
}

function overallOf(pipelines: StatusPipeline[], maxLagSec: number | null): StatusPayload["overall"] {
  const required = pipelines.filter(countsTowardOverall);
  if (!required.some((pipeline) => pipeline.ok)) return "unreachable";
  const allOk = required.every((pipeline) => pipeline.ok);
  return allOk && (maxLagSec ?? 0) < HEALTHY_LAG_SEC ? "healthy" : "degraded";
}

async function run(env: MarketsEnv): Promise<StatusPayload> {
  const checkedAtMs = Date.now();
  const nowSec = Math.floor(checkedAtMs / 1000);
  const db = getDb();

  const rpcRun = probeRpc();
  const [health, session] = await Promise.all([readOpsHealth(env.priceFeedUrl), readOpsSession(env.priceFeedUrl)]);
  const view = sessionView(session);
  const ops = { health, session, inSession: view.inSession };
  const latest = session.ok ? (session.value.calendar?.recent.at(-1) ?? null) : null;
  const scope: PrintScope | null = session.ok && latest
    ? { nowSec, inSession: view.inSession, session: { date: latest.date, openSec: latest.openSec }, lanes: session.value.lanes, relay: relayCounters(health) }
    : null;
  const scopeWhy = session.ok ? "ops /session lists no session that has opened" : session.why;

  const [rpc, store, faucet, sponsor, prices] = await Promise.all([
    rpcRun,
    probeStore(),
    probeFaucet(checkedAtMs),
    sponsorRow(),
    Promise.all(priceAssets(session).map((asset) => probePrice(asset, checkedAtMs, view.inSession))),
  ]);
  const index = await probeIndex({ db, rpcSlot: rpc.slot, health, scope, scopeWhy });

  const pipelines: StatusPipeline[] = [
    rpc.pipeline,
    index.slotLag,
    indexerRow(ops),
    ...index.relays,
    ...index.mixes,
    pythTrialRow(ops),
    pythIndexRow(ops),
    index.redstone,
    switchboardRow(),
    index.crossCheck,
    lanesRow(ops),
    faucet,
    sponsor,
    store,
    ...heartbeatRows(ops),
    ...prices,
    probeSensei(),
  ];

  // An ops loop may rest a minute between passes and is judged by ops' own 5-minute rule, so heartbeat silence shows on its
  // row but stays out of the reference's 2-minute data-lag verdict.
  const lagging = pipelines.filter((pipeline) => pipeline.ok && !pipeline.expected && pipeline.lagSec !== null && !pipeline.id.startsWith("ops:"));
  const worst = lagging.reduce<StatusPipeline | null>((max, pipeline) => (max === null || pipeline.lagSec! > max.lagSec! ? pipeline : max), null);
  const maxLagSec = worst?.lagSec ?? null;
  return { checkedAtMs, overall: overallOf(pipelines, maxLagSec), maxLagSec, maxLagPipeline: worst?.label ?? null, slot: rpc.slot, session: view.payload, pipelines };
}

export function statusRun(env: MarketsEnv): Promise<StatusPayload> {
  if (lastRun && Date.now() - lastRun.atMs < RUN_REUSE_MS) return Promise.resolve(lastRun.payload);
  inFlight ??= run(env)
    .then((payload) => {
      lastRun = { atMs: Date.now(), payload };
      return payload;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
