import { describe, expect, it } from "vitest";
import { divergenceCentiBps, formatCentiBps, gradeArchive, gradeCrossCheck, gradeFaucet, gradeHeartbeat, gradeIndexer, gradeLanes, gradeRelay, gradeSlotLag, trialSessionsLeft } from "./grade";
import { lagTone } from "./protocol";
import { mixRows, relayRows, type MixRow, type PrintScope } from "./rows-prints";

const OPEN_SEC = 1_789_479_000; // 2026-09-15 13:30Z

describe("status thresholds (proof-analytics.md §2.5)", () => {
  it("grades slots, indexer lag and heartbeats at their edges", () => {
    expect([50, 51, 300, 301].map(gradeSlotLag)).toEqual(["good", "warn", "warn", "bad"]);
    const beat = { subscription: "connected", lastLagSec: 9, gapsOpen: 0, failures: 0 };
    expect(gradeIndexer(beat, true)).toBe("good");
    expect(gradeIndexer({ ...beat, lastLagSec: 10 }, true)).toBe("warn");
    expect(gradeIndexer({ ...beat, lastLagSec: 60 }, true)).toBe("bad");
    expect(gradeIndexer({ ...beat, subscription: "reconnecting", lastLagSec: null }, false)).toBe("good");
    expect(gradeIndexer({ ...beat, failures: 3 }, false)).toBe("bad");
    const now = 1_000_000;
    expect(gradeHeartbeat({ everyMs: 5_000, startedMs: 0, lastOkMs: now - 300_000, failures: 2 }, now)).toEqual({ verdict: "good", lagSec: 300 });
    expect(gradeHeartbeat({ everyMs: 5_000, startedMs: 0, lastOkMs: now - 300_001, failures: 0 }, now).verdict).toBe("bad");
    expect(gradeHeartbeat({ everyMs: 200_000, startedMs: 0, lastOkMs: now - 500_000, failures: 0 }, now).verdict).toBe("good");
    expect(gradeHeartbeat({ everyMs: 5_000, startedMs: now, lastOkMs: null, failures: 3 }, now).verdict).toBe("bad");
  });

  it("measures divergence in integer centi-bps and grades 10 / 25 bps", () => {
    expect(divergenceCentiBps(35_907_116_349n, 35_900_500_000n)).toBe(184n); // 0.0184 % = 1.84 bps
    expect(formatCentiBps(184n)).toBe("1.84");
    expect(formatCentiBps(7n)).toBe("0.07");
    expect([1_000n, 1_001n, 2_500n, 2_501n].map(gradeCrossCheck)).toEqual(["good", "warn", "warn", "bad"]);
    expect(gradeCrossCheck(null)).toBe("good");
  });

  it("grades the relay, archive, faucet and lanes", () => {
    const relay = { missingVoids: 0, recentLagSec: 30, behindLanes: 0, missed: 0 };
    expect(gradeRelay(relay)).toBe("good");
    expect(gradeRelay({ ...relay, recentLagSec: 31 })).toBe("warn");
    expect(gradeRelay({ ...relay, recentLagSec: 121 })).toBe("bad");
    expect(gradeRelay({ ...relay, behindLanes: 1 })).toBe("warn");
    expect(gradeRelay({ ...relay, missingVoids: 1 })).toBe("bad");
    expect(gradeArchive({ maxFetchLagMs: 20_000, minSigners: 5, lateCount: 0 })).toBe("good");
    expect(gradeArchive({ maxFetchLagMs: 20_001, minSigners: 5, lateCount: 0 })).toBe("warn");
    expect(gradeArchive({ maxFetchLagMs: 1_000, minSigners: 3, lateCount: 0 })).toBe("warn");
    expect(gradeArchive({ maxFetchLagMs: 1_000, minSigners: 2, lateCount: 0 })).toBe("bad");
    expect(gradeArchive({ maxFetchLagMs: 1_000, minSigners: 5, lateCount: 1 })).toBe("bad");
    expect(gradeFaucet(true, true, 3_000_000_000n)).toBe("good");
    expect(gradeFaucet(true, true, 2_999_999_999n)).toBe("warn");
    expect(gradeFaucet(true, false, 9_000_000_000n)).toBe("bad");
    expect(gradeLanes(["open #3 13:30–13:35 v1", "paused: no signed source"])).toBe("good");
    expect(gradeLanes(["open #3 13:30–13:35 v1", "waiting: no free book"])).toBe("warn");
    expect(gradeLanes(["closed: no calendar"])).toBe("bad");
  });

  it("counts Pyth trial sessions from the upcoming list, marking a capped list", () => {
    const day = (closeSec: number) => ({ closeSec });
    const upcoming = [day(100), day(200), day(300), day(400), day(500)];
    expect(trialSessionsLeft(50, 1_000, upcoming)).toEqual({ ended: false, left: 5, capped: true });
    expect(trialSessionsLeft(50, 250, upcoming)).toEqual({ ended: false, left: 2, capped: false });
    expect(trialSessionsLeft(1_001, 1_000, upcoming).ended).toBe(true);
  });
});

describe("print rows", () => {
  const scope = (nowSec: number, inSession: boolean): PrintScope => ({
    nowSec,
    inSession,
    session: { date: "2026-09-15", openSec: OPEN_SEC },
    lanes: { "TSLA-5m": "open #4 13:45–13:50 v1", "NVDA-5m": "open #4 13:45–13:50 v1" },
    relay: { missed: 0, startedAt: "04:21:34 UTC" },
  });
  const row = (symbol: string, which: number, source: number, lastSec: number, lagSec: number, missingVoid = 0): MixRow => ({
    symbol, cadence_sec: 300, which, source, windows: 3, max_record_lag_sec: lagSec, last_source_ts_sec: String(lastSec), missing_void: missingVoid,
  });

  it("keeps a relay green when the last due boundary is recorded, amber when a lane falls behind", () => {
    const now = OPEN_SEC + 1_000; // 13:46:40 → the last boundary due is 13:40; NVDA stops at 13:35
    const mix = [row("TSLA", 0, 1, OPEN_SEC + 900, 20), row("NVDA", 0, 2, OPEN_SEC + 300, 25)];
    const [pyth, redstone] = relayRows(mix, mix, scope(now, true));
    expect(pyth).toMatchObject({ ok: true, grade: "good", lagSec: 20, expected: false });
    expect(redstone).toMatchObject({ ok: true, grade: "warn" });
    expect(redstone!.detail).toContain("1 behind: NVDA-5m");
  });

  it("answers closed (expected) off-hours even over a session with missing-print voids", () => {
    const mix = [row("TSLA", 0, 1, OPEN_SEC + 900, 614, 2), row("NVDA", 1, 2, OPEN_SEC + 900, 20, 1)];
    const rows = [...relayRows(mix, [], scope(OPEN_SEC - 3_600, false)), ...mixRows(mix, scope(OPEN_SEC - 3_600, false))];
    expect(rows.every((pipeline) => pipeline.ok && pipeline.expected && lagTone(pipeline) === "off")).toBe(true);
    const inSession = mixRows(mix, scope(OPEN_SEC + 1_000, true));
    expect(inSession[0]).toMatchObject({ ok: false, detail: "Pyth 1 · RedStone 1 · 3 missing-print voids" });
  });
});
