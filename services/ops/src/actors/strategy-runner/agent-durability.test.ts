import type { AgentContext, StrategyRecord } from "@masayume/core/strategies";
import type { Bytes32, EventMarket } from "@masayume/core/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ claim: vi.fn(), previous: vi.fn(), store: vi.fn(), lanes: vi.fn(), context: vi.fn(), record: vi.fn(), decide: vi.fn(), decisions: vi.fn() }));
vi.mock("@masayume/db", () => ({ beginStrategyDecision: mocks.claim, getStrategyDecision: mocks.previous, recordStrategyDecision: mocks.store, listStrategyDecisions: mocks.decisions }));
vi.mock("@masayume/markets", () => ({ marketsProvider: { listLiveLanes: mocks.lanes } }));
vi.mock("@masayume/markets/strategies", () => ({ readAgentContext: mocks.context }));
vi.mock("./agent-record", () => ({ readAgentRecord: mocks.record, settlementReader: () => vi.fn() }));
vi.mock("@masayume/brain", async (original) => ({ ...await original<object>(), decideAgentWindow: mocks.decide }));

import { scanVenueWithAgent, warmAgentState, type AgentRunner } from "./agent";
import { readRunnerEnv } from "./env";

const market = { marketId: `0x${"11".repeat(32)}`, asset: "BTC", intervalSec: 900, tradingStartSec: 1_000, expirySec: 1_900, openingPriceRaw: 10_000n, status: "Trading", voided: false, finalized: false } as EventMarket;
const nowMs = 1_300_000;
const spec = { preset: "agent" as const, persona: "Follow the trend.", posture: "balanced" as const, cadences: [900] };
const strategy = { strategyId: 1n, envelope: { maxStakePerTradeBase: 100n, maxDailySpendBase: 1_000n, maxOpenPositions: 1, maxPriceRaw: 0n } } as StrategyRecord;
const context: AgentContext = { asset: "BTC", intervalSec: 900, tradingStartSec: 1_000, openingRaw: 10_000n, emaRaw: 10_020n, spotRaw: 10_020n, feedDecimals: 2, samples: [], upCents: 50, downCents: 50, stakeBase: 100n, collateralDecimals: 6, elapsedSec: 300, leftSec: 600 };
const verdict = { side: "up" as const, confidence: 0.8, why: "steady trend" };
const decision = { side: "up" as const, moveBps: 20, thresholdBps: 0, reason: "agent bets up" };
const ok = <T>(value: T) => ({ ok: true as const, value, stale: false, asOfMs: nowMs });
const runner = (): AgentRunner => ({ env: readRunnerEnv({ STRATEGY_IDS: "1" }), venueId: `0x${"22".repeat(32)}` as Bytes32, runnerKey: "runner", log: vi.fn(), onReading: vi.fn().mockResolvedValue(undefined), agent: { brain: { providerName: "fixture", modelId: "test", via: "direct", model: {} } as AgentRunner["agent"]["brain"], missing: "", read: new Map(), callsAtMs: [] } });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.lanes.mockResolvedValue(ok({ lanes: [{ markets: [market] }] }));
  mocks.context.mockResolvedValue(ok(context));
  mocks.record.mockResolvedValue({ recent: [], consecutiveLosses: 0, lostTodayBase: 0n, lastLossAtSec: null });
  mocks.previous.mockResolvedValue(null);
  mocks.claim.mockResolvedValue("acquired");
  mocks.store.mockResolvedValue(true);
  mocks.decide.mockResolvedValue({ read: { ok: true, modelId: "fixture/test", verdict }, decision, promptHash: "hash" });
});

describe("durable agent reads", () => {
  it("reserves before calling the model and stores before returning an executable candidate", async () => {
    const scan = await scanVenueWithAgent(runner(), strategy, spec, nowMs);
    expect(scan.candidates).toHaveLength(1);
    expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(mocks.decide.mock.invocationCallOrder[0]!);
    expect(mocks.decide.mock.invocationCallOrder[0]).toBeLessThan(mocks.store.mock.invocationCallOrder[0]!);
    expect(mocks.store).toHaveBeenCalledWith(expect.objectContaining({ verdictSide: "up", gate: "trade", dryRun: false }));
  });
  it("does not bill a second model call when a pending read already owns the Window", async () => {
    mocks.claim.mockResolvedValue("existing");
    const scan = await scanVenueWithAgent(runner(), strategy, spec, nowMs);
    expect(scan.candidates).toHaveLength(0);
    expect(scan.why).toContain("read already reserved");
    expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("resumes a recorded trade after restart using current risk and quote without another model call", async () => {
    mocks.previous.mockResolvedValue({ gate: "trade", side: "up", verdictSide: "up", confidence: 0.8, why: "steady trend", gateReason: "agent bets up" });
    expect((await scanVenueWithAgent(runner(), strategy, spec, nowMs)).candidates).toHaveLength(1);
    mocks.context.mockResolvedValue(ok({ ...context, upCents: 90 }));
    expect((await scanVenueWithAgent(runner(), strategy, spec, nowMs)).candidates).toHaveLength(0);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("keeps a held or interrupted read held throughout its Window", async () => {
    for (const gate of ["held", "failed"]) {
      mocks.previous.mockResolvedValue({ gate, side: null, verdictSide: "up", confidence: 0.8, why: "steady trend", gateReason: "holding this Window" });
      expect((await scanVenueWithAgent(runner(), strategy, spec, nowMs)).candidates).toHaveLength(0);
    }
    expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("holds without a model call when the required risk store or reservation fails", async () => {
    mocks.record.mockRejectedValueOnce(new Error("risk memory unavailable"));
    await expect(scanVenueWithAgent(runner(), strategy, spec, nowMs)).rejects.toThrow("risk memory unavailable");
    mocks.claim.mockRejectedValueOnce(new Error("decision store unavailable"));
    await expect(scanVenueWithAgent(runner(), strategy, spec, nowMs)).rejects.toThrow("decision store unavailable");
    expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("never hands an unstored model decision to execution", async () => {
    mocks.store.mockResolvedValue(false);
    await expect(scanVenueWithAgent(runner(), strategy, spec, nowMs)).rejects.toThrow("decision could not be stored");
    expect(mocks.decide).toHaveBeenCalledTimes(1);
  });
  it("does not call the model from stale context", async () => {
    mocks.context.mockResolvedValue({ ...ok(context), stale: true });
    expect((await scanVenueWithAgent(runner(), strategy, spec, nowMs)).candidates).toHaveLength(0);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.decide).not.toHaveBeenCalled();
  });
  it("counts interrupted provider claims in the warmed hourly budget", async () => {
    const r = runner();
    r.env.agentMaxCallsPerHour = 1;
    mocks.decisions.mockResolvedValue([{ strategyId: "1", marketId: "older", gate: "failed", why: "Runner interrupted during the model read", decidedAtMs: nowMs - 10_000 }]);
    await warmAgentState(r.agent, nowMs / 1000);
    expect((await scanVenueWithAgent(r, strategy, spec, nowMs)).why).toContain("call budget spent");
    expect(mocks.decide).not.toHaveBeenCalled();
  });
});
