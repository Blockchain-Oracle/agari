import { isOk } from "@masayume/core/schemas";
import { deriveRunnerHealth, parseStrategyMetadata, scoreFill, strategyRecord, type AgentWindowOutcome, type FillSettlement, type StrategyFill, type StrategyRecord } from "@masayume/core/strategies";
import { SIDE_TO_OUTCOME, toMarketId, type Address, type Hex, type MarketId } from "@masayume/core/types";
import { isDbConfigured, latestHeartbeats, listPlaybooks, listStrategyDecisions, listStrategyFills, recentHeartbeats, type StrategyDecisionRecord, type StrategyFillRecord } from "@masayume/db";
import { ensureMarkets, loadCollateral, marketsProvider, mapPool, parseMarketsEnv, unwrap } from "@masayume/markets";
import { listStrategies, resolveRegistryDeployment } from "@masayume/markets/strategies";
import type { DecisionWire, HealthPayload, StrategiesPayload, StrategyWire } from "./protocol";

const CACHE_TTL_MS = 20_000;
const FILL_LIMIT = 500;
const DECISION_LIMIT = 200;
const DECISIONS_PER_CARD = 8;
const RECENT_WHY = 12;
const CONCURRENCY = 6;
const ASSET = "all live venue assets";

let cache: { payload: StrategiesPayload; atMs: number } | null = null;
let inFlight: Promise<StrategiesPayload> | null = null;

function boot(): void {
  ensureMarkets(parseMarketsEnv({ venueId: process.env.NEXT_PUBLIC_VENUE_ID }));
}

function toFill(row: StrategyFillRecord): StrategyFill {
  return {
    txHash: row.txHash as Hex,
    strategyId: BigInt(row.strategyId),
    grantId: BigInt(row.grantId),
    owner: row.owner as Address,
    marketId: toMarketId(row.marketId),
    side: row.side,
    cashDeltaBase: BigInt(row.cashDelta),
    tokenDeltaRaw: BigInt(row.tokenDelta),
    atSec: row.atSec,
    dryRun: row.dryRun,
  };
}

interface WindowFacts {
  settlement: FillSettlement;
  feeBps: number;
  intervalSec: number | null;
  asset: string | null;
}

/** Settlement facts per Window, read once per market rather than once per fill or decision. */
async function settlementsFor(marketIds: readonly MarketId[]): Promise<Map<MarketId, WindowFacts>> {
  const rows = await mapPool(marketIds, CONCURRENCY, async (marketId) => {
    const [market, fee] = await Promise.all([marketsProvider.getMarket(marketId), marketsProvider.settlementFeeBps(marketId)]);
    const m = isOk(market) ? market.value : null;
    const settled = m ? m.status === "Resolved" || m.status === "Voided" || m.status === "Finalized" : false;
    return { marketId, settlement: { settled, voided: m?.voided ?? false, winningOutcome: m?.winningOutcome ?? null }, feeBps: isOk(fee) ? fee.value : 0, intervalSec: m?.intervalSec ?? null, asset: m?.asset ?? null };
  });
  return new Map(rows.map((r) => [r.marketId, { settlement: r.settlement, feeBps: r.feeBps, intervalSec: r.intervalSec, asset: r.asset }]));
}

function outcomeOf(side: "up" | "down" | null, settlement: FillSettlement | undefined): AgentWindowOutcome | null {
  if (!side) return null;
  if (!settlement || !settlement.settled) return "open";
  if (settlement.voided) return "void";
  return settlement.winningOutcome === SIDE_TO_OUTCOME[side] ? "won" : "lost";
}

function toDecisionWire(row: StrategyDecisionRecord, facts: WindowFacts | undefined): DecisionWire {
  return {
    marketId: row.marketId,
    decidedAtMs: row.decidedAtMs,
    verdictSide: row.verdictSide,
    confidence: row.confidence,
    why: row.why,
    gate: row.gate,
    gateReason: row.gateReason,
    side: row.side,
    filled: row.filled,
    model: row.model,
    intervalSec: facts?.intervalSec ?? null,
    asset: facts?.asset ?? null,
    outcome: outcomeOf(row.side, facts?.settlement),
  };
}

function median(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)] as bigint;
}

async function compute(): Promise<StrategiesPayload> {
  boot();
  const collateral = unwrap(await loadCollateral());
  const nowMs = Date.now();
  const deployed = resolveRegistryDeployment() !== null;
  const strategies: StrategyRecord[] = deployed ? (unwrap(await listStrategies()) ?? []) : [];
  const [fillRows, beats, playbooks, decisionRows] = await Promise.all([listStrategyFills(null, FILL_LIMIT), latestHeartbeats(), listPlaybooks(), listStrategyDecisions(null, DECISION_LIMIT)]);
  const fills = (fillRows ?? []).map(toFill);
  const settlements = await settlementsFor([...new Set([...fills.map((f) => f.marketId), ...(decisionRows ?? []).map((d) => toMarketId(d.marketId))])]);
  const scored = fills.map((f) => {
    const s = settlements.get(f.marketId);
    return scoreFill(f, s?.settlement ?? null, s?.feeBps ?? 0);
  });
  const beatBy = new Map((beats ?? []).map((b) => [b.strategyId, b]));
  const playbookBy = new Map((playbooks ?? []).map((p) => [p.strategyId, p.body]));
  // Rows arrive newest first, so the first eight per strategy are its latest Windows.
  const decisionsBy = new Map<string, DecisionWire[]>();
  for (const row of decisionRows ?? []) {
    const list = decisionsBy.get(row.strategyId) ?? [];
    if (list.length < DECISIONS_PER_CARD) list.push(toDecisionWire(row, settlements.get(toMarketId(row.marketId))));
    decisionsBy.set(row.strategyId, list);
  }

  const wires: StrategyWire[] = strategies.map((s) => {
    const id = s.strategyId.toString();
    const own = scored.filter((f) => f.strategyId === s.strategyId);
    const record = strategyRecord(own);
    const beat = beatBy.get(id) ?? null;
    const health = deriveRunnerHealth({ lastTickMs: beat?.tickAtMs ?? null, intervalMs: beat?.intervalMs ?? null, why: beat?.why ?? null, nowMs, reachable: beats !== null });
    const isAgent = parseStrategyMetadata(s.metadata)?.spec.preset === "agent";
    const decisions = decisionsBy.get(id) ?? [];
    return {
      strategyId: id,
      creator: s.creator,
      runner: s.runner,
      specHash: s.specHash,
      metadata: s.metadata,
      envelope: {
        maxStakePerTradeBase: s.envelope.maxStakePerTradeBase.toString(),
        maxDailySpendBase: s.envelope.maxDailySpendBase.toString(),
        maxOpenPositions: s.envelope.maxOpenPositions,
        maxPriceRaw: s.envelope.maxPriceRaw.toString(),
      },
      feeBase: s.feeBase.toString(),
      active: s.active,
      createdAtSec: s.createdAtSec,
      subscribers: s.subscribers,
      revision: s.revision,
      record: {
        fills: record.fills,
        settled: record.settled,
        wins: record.wins,
        losses: record.losses,
        voids: record.voids,
        netBase: record.netBase.toString(),
        stakedBase: record.stakedBase.toString(),
        curve: record.curve.map((p) => ({ atSec: p.atSec, cumBase: p.cumBase.toString() })),
        lastActiveSec: record.lastActiveSec,
        distinctSubscribers: record.distinctSubscribers,
        typicalCostBase: median(own.map((f) => f.cashDeltaBase)).toString(),
      },
      playbook: playbookBy.get(id) ?? null,
      health,
      agent: isAgent ? { model: decisions[0]?.model ?? null, decisions } : null,
    };
  });

  return {
    deployed,
    strategies: wires,
    fills: scored.map((f) => ({
      txHash: f.txHash,
      strategyId: f.strategyId.toString(),
      owner: f.owner,
      marketId: f.marketId,
      side: f.side,
      cashDeltaBase: f.cashDeltaBase.toString(),
      tokenDeltaRaw: f.tokenDeltaRaw.toString(),
      atSec: f.atSec,
      settled: f.settled,
      payoutBase: f.payoutBase === null ? null : f.payoutBase.toString(),
    })),
    stores: { fills: fillRows !== null, heartbeats: beats !== null, decisions: decisionRows !== null },
    decimals: collateral.decimals,
    symbol: collateral.symbol,
    asset: ASSET,
    computedAtMs: nowMs,
  };
}

/** One registry read per few seconds, shared by every reader. */
export async function readStrategies(): Promise<StrategiesPayload> {
  if (cache && Date.now() - cache.atMs < CACHE_TTL_MS) return cache.payload;
  if (!inFlight) {
    inFlight = compute()
      .then((payload) => {
        cache = { payload, atMs: Date.now() };
        return payload;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Health is derived at request time from the heartbeat store, never served from a stale healthy claim (Story 6.6). */
export async function readHealth(strategyIds: readonly string[]): Promise<HealthPayload> {
  const nowMs = Date.now();
  if (!isDbConfigured()) return { reachable: false, strategies: {}, computedAtMs: nowMs };
  const out: HealthPayload["strategies"] = {};
  try {
    for (const id of strategyIds) {
      const recent = (await recentHeartbeats(id, RECENT_WHY)) ?? [];
      const latest = recent[0] ?? null;
      const health = deriveRunnerHealth({ lastTickMs: latest?.tickAtMs ?? null, intervalMs: latest?.intervalMs ?? null, why: latest?.why ?? null, nowMs, reachable: true });
      out[id] = { ...health, recent: recent.map((b) => ({ tickAtMs: b.tickAtMs, why: b.why })) };
    }
    return { reachable: true, strategies: out, computedAtMs: nowMs };
  } catch {
    return { reachable: false, strategies: {}, computedAtMs: nowMs };
  }
}
