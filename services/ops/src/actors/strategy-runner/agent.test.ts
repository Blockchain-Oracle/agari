import type { StrategyRecord } from "@masayume/core/strategies";
import type { Address, Bytes32 } from "@masayume/core/types";
import { describe, expect, it } from "vitest";
import { agentBootLine, createAgentState, scanVenueWithAgent, takeCall, type AgentState } from "./agent";
import { readRunnerEnv } from "./env";

const VENUE = `0x${"11".repeat(32)}` as Bytes32;
const strategy: StrategyRecord = {
  strategyId: 7n,
  creator: "0xaaaa111111111111111111111111111111111111" as Address,
  runner: "0xbbbb111111111111111111111111111111111111" as Address,
  specHash: `0x${"ab".repeat(32)}`,
  metadata: "{}",
  envelope: { maxStakePerTradeBase: 5_000_000n, maxDailySpendBase: 50_000_000n, maxOpenPositions: 2, maxPriceRaw: 0n },
  feeBase: 0n,
  active: true,
  createdAtSec: 0,
  subscribers: 1,
  revision: 0,
};
const spec = { preset: "agent" as const, persona: "Follow the trend.", posture: "balanced" as const, cadences: [900] };

/** No AI variable is set in the test environment, so the resolver answers null: the honest default. */
function unconfigured(): AgentState {
  const state = createAgentState();
  return { ...state, brain: null, missing: "ANTHROPIC_API_KEY (for anthropic/claude-opus-5), or AI_GATEWAY_API_KEY" };
}

describe("agent runner without a brain", () => {
  it("boots by naming the missing variable, never a key", () => {
    expect(agentBootLine(unconfigured())).toBe("agent brain not configured: set ANTHROPIC_API_KEY (for anthropic/claude-opus-5), or AI_GATEWAY_API_KEY");
  });
  it("holds with the variable named and reads nothing — no lanes, no model, no row", async () => {
    const env = readRunnerEnv({ STRATEGY_IDS: "7", DRY_RUN: "1" });
    const logs: string[] = [];
    const scan = await scanVenueWithAgent({ env, venueId: VENUE, runnerKey: "unconfigured", agent: unconfigured(), log: (why) => logs.push(why) }, strategy, spec, 1_788_400_000_000);
    expect(scan).toEqual({ candidates: [], scanned: 0, closestBps: null, why: "agent brain not configured — set ANTHROPIC_API_KEY (for anthropic/claude-opus-5), or AI_GATEWAY_API_KEY on the runner; holding" });
    expect(logs).toEqual([]);
  });
});

describe("the call budget", () => {
  it("is a sliding hour per runner", () => {
    const state = unconfigured();
    const t0 = 1_000_000;
    expect(takeCall(state, 2, t0)).toBe(true);
    expect(takeCall(state, 2, t0 + 1)).toBe(true);
    expect(takeCall(state, 2, t0 + 2)).toBe(false);
    expect(takeCall(state, 2, t0 + 3_600_000)).toBe(true);
  });
});

describe("runner env", () => {
  it("reads the agent knobs with their floors and defaults", () => {
    expect(readRunnerEnv({})).toMatchObject({ agentMaxCallsPerHour: 60, agentTimeoutMs: 20_000, intervalMs: 30_000, dryRun: false });
    expect(readRunnerEnv({ AGENT_MAX_CALLS_PER_HOUR: "12", AGENT_TIMEOUT_MS: "500", DRY_RUN: "true" })).toMatchObject({ agentMaxCallsPerHour: 12, agentTimeoutMs: 20_000, dryRun: true });
    expect(readRunnerEnv({ AGENT_MAX_CALLS_PER_HOUR: "0" }).agentMaxCallsPerHour).toBe(60);
  });
});
