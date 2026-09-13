import { describe, expect, it } from "vitest";
import type { RunnerHealth } from "@masayume/core/strategies";
import type { VaultGrant } from "@masayume/core/vault";
import { strategyActivityOf } from "./activity";
import { copyStateOf, type CopyState } from "./lifecycle";

const NOW = 1_783_814_400_000;
const RUNNER = "0x1111111111111111111111111111111111111111";
const GRANT: VaultGrant = { grantId: 8n, owner: RUNNER, actor: RUNNER, kind: "strategy", revoked: false, expiresAtSec: NOW / 1000 + 100, spentDay: 0, spentTodayBase: 0n, openPositions: 0, caps: { maxStakePerTradeBase: 1n, maxDailySpendBase: 5n, maxOpenPositions: 1, maxPriceRaw: 0n }, budgetBase: 5n };
const HEALTH: RunnerHealth = { kind: "alive", lastTickMs: NOW - 1_000, intervalMs: 30_000, why: "scanned 6 markets, closest trigger 8 bps away; 1 live subscriber" };
const activity = (patch: Partial<Parameters<typeof strategyActivityOf>[0]> = {}) => strategyActivityOf({ state: "copying", grant: GRANT, health: HEALTH, nowMs: NOW, ...patch });
const report = (why: string) => ({ ...HEALTH, why });

describe("strategy operating state alongside copy permission", () => {
  it("explains a full position limit without changing enabled consent into a pause", () => {
    const grant = { ...GRANT, openPositions: 1 };
    const state = copyStateOf({ active: true, runner: RUNNER }, { strategyId: 1n, subscriber: RUNNER, grantId: 8n, subscribedAtSec: 1, active: true, live: true }, grant, NOW / 1000);
    expect(state).toBe("copying");
    expect(activity({ state, grant, health: report("scanned 6 markets, 6 past the trigger; 0 filled, 6 skipped") })).toMatchObject({ label: "Awaiting settlement", detail: "Your 1-position limit is reached. A position must settle before a new one can open.", heartbeat: "Runner connected" });
    expect(activity({ grant: { ...grant, caps: { ...grant.caps, maxOpenPositions: 2 } } }).label).toBe("Watching");
  });

  it("keeps paused, expired, and exhausted permissions distinct while showing open positions", () => {
    for (const [state, label] of [["paused", "Paused"], ["expired", "Expired"], ["unfunded", "Budget exhausted"], ["inactive", "Paused"]] as const) {
      expect(activity({ state, grant: { ...GRANT, openPositions: 1 } })).toMatchObject({ label, positions: expect.stringContaining("1 position remains open") });
    }
    for (const state of ["not-copying", "replaced", "runner-changed"] as CopyState[]) expect(activity({ state }).label).toBe("Waiting for permission");
    expect(activity({ state: "checking", grant: { ...GRANT, openPositions: 1 } })).toMatchObject({ label: "Unavailable", positions: null });
  });

  it("does not present old, absent, or unreachable model reads as current activity", () => {
    const reading = report("reading ETH/5m; awaiting the model's verdict");
    expect(activity({ health: reading }).label).toBe("Reading a Window");
    expect(activity({ health: { ...reading, lastTickMs: NOW - 180_000 } })).toMatchObject({ label: "Unavailable", heartbeat: "Runner heartbeat is late" });
    expect(activity({ health: { ...reading, kind: "unknown" } }).label).toBe("Unavailable");
    expect(activity({ health: null }).label).toBe("Unavailable");
    expect(activity({ health: { ...reading, kind: "never-started", lastTickMs: null } }).label).toBe("Waiting for the first check");
    expect(activity({ health: { ...reading, lastTickMs: NOW - 200_000, intervalMs: 120_000 } }).label).toBe("Reading a Window");
  });

  it("retains a verified position constraint even when the runner is unreachable", () => {
    expect(activity({ grant: { ...GRANT, openPositions: 1 }, health: null })).toMatchObject({ label: "Awaiting settlement", heartbeat: "Runner status unavailable" });
  });

  it("keeps an unknown broadcast held instead of promising another scan or resend", () => {
    expect(activity({ grant: { ...GRANT, openPositions: 1 }, health: report("confirmation unknown for this runner's previous attempt; holding all new submissions and not resending") })).toMatchObject({ label: "Held", detail: expect.stringContaining("will not be resent") });
  });

  it("labels fills as a past strategy-wide report and never turns a dry run into a fill", () => {
    expect(activity({ health: report("scanned 6 markets, 6 past the trigger; 2 filled, 4 skipped") })).toMatchObject({ label: "Filled in last scan", detail: expect.stringContaining("across this strategy’s subscribers") });
    expect(activity({ health: report("scanned 6 markets, 6 past the trigger; 2 filled, 4 skipped (dry run)") }).label).toBe("Dry run");
    expect(activity({ health: report("scanned 6 markets, 6 past the trigger; 0 filled, 6 skipped") })).toMatchObject({ label: "Held in last scan", detail: expect.stringContaining("does not give each subscriber’s skip reason") });
  });

  it("explains the UTC spending limit and resumes watching when its day rolls over", () => {
    const grant = { ...GRANT, spentDay: Math.floor(NOW / 86_400_000), spentTodayBase: GRANT.caps.maxDailySpendBase };
    expect(activity({ grant })).toMatchObject({ label: "Held", detail: expect.stringContaining("00:00 UTC") });
    expect(activity({ grant: { ...grant, spentDay: grant.spentDay - 1 } }).label).toBe("Watching");
  });

  it("separates dependency failures, held reads, and unrecognized report text", () => {
    expect(activity({ health: report("lanes unreadable: stale state; 1 live subscriber") }).label).toBe("Unavailable");
    expect(activity({ health: report("holding: risk memory unavailable") }).label).toBe("Held");
    expect(activity({ health: report("read 1 of 2 agent Windows: ETH/5m held; BTC/5m: slot opens in 20s; 1 live subscriber") }).label).toBe("Held in last read");
    expect(activity({ health: report("published; waiting for a funded live subscriber") }).label).toBe("Waiting for the next check");
    expect(activity({ health: report("a future report format") }).label).toBe("Operation unavailable");
  });
});
