import { sessionAt, type SessionCalendar } from "@agari/core/market";
import { describe, expect, it } from "vitest";
import { planSeries, type PlanClock, type PlanSeries } from "./plan";
import type { VersionWindow } from "./versions";

// Fri 2026-09-25 (regular) and Mon 2026-09-28; 09-26/27 closed. EDT: 09:30 ET = 13:30Z, 16:00 ET = 20:00Z.
const FRI = sessionAt("2026-09-25", 570, 960);
const MON = sessionAt("2026-09-28", 570, 960);
const CALENDAR: SessionCalendar = { fromDate: "2026-09-21", toDate: "2026-10-02", sessions: [FRI, MON], unknownDates: [] };
const TRIAL_END = FRI.closeSec;
const TSLA: VersionWindow[] = [
  { validFromSec: FRI.openSec - 86_400 * 14, validUntilSec: TRIAL_END, primarySource: 1, checkSource: 2, openAdmissionSec: 900, checkAdmissionSec: 120 },
  { validFromSec: TRIAL_END, validUntilSec: null, primarySource: 2, checkSource: 0, openAdmissionSec: 900, checkAdmissionSec: 0 },
];
const QQQ: VersionWindow[] = [TSLA[0]!];
const NVDA: VersionWindow[] = [{ validFromSec: 0, validUntilSec: null, primarySource: 2, checkSource: 0, openAdmissionSec: 900, checkAdmissionSec: 0 }];

const series = (over: Partial<PlanSeries> = {}): PlanSeries => ({
  key: "TSLA-5m", symbol: "TSLA", cadenceSec: 300, nextIndex: 7n, lastExpirySec: 0, versions: TSLA, freeBooks: ["BookA", "BookB"], ...over,
});
const clock = (nowSec: number, over: Partial<PlanClock> = {}): PlanClock => ({ calendar: CALENDAR, nowSec, leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, skips: [], ...over });

describe("window-roller plan", () => {
  it("opens the session's first Window within the lead, as SessionOpen on the covering trial version", () => {
    const plan = planSeries(series(), clock(FRI.openSec - 100));
    expect(plan).toMatchObject({ kind: "open", index: 7n, policyVersion: 0, openKind: 1, closeKind: 0, book: "BookA" });
    if (plan.kind === "open") expect(plan.window.tradingStartSec).toBe(FRI.openSec);
  });

  it("waits outside the lead and reports closed before the session", () => {
    expect(planSeries(series(), clock(FRI.openSec - 3_600))).toMatchObject({ kind: "wait", wakeSec: FRI.openSec - 120, state: "closed: no session" });
  });

  it("opens back-to-back after last_expiry and skips a Window with under a minute left", () => {
    const last = FRI.openSec + 300;
    const plan = planSeries(series({ lastExpirySec: last }), clock(last - 100));
    expect(plan.kind === "open" && plan.window.tradingStartSec).toBe(last);
    const late = planSeries(series({ lastExpirySec: last }), clock(last + 250));
    expect(late.kind === "open" && late.window.tradingStartSec).toBe(last + 300);
  });

  it("aligns 60m to the ET clock: first 10:00–11:00, last ends at the close as SessionClose", () => {
    const first = planSeries(series({ cadenceSec: 3_600 }), clock(FRI.openSec));
    expect(first.kind === "wait" && first.window.tradingStartSec).toBe(FRI.openSec + 1_800);
    const last = planSeries(series({ cadenceSec: 3_600, lastExpirySec: FRI.closeSec - 3_600 }), clock(FRI.closeSec - 3_700));
    expect(last).toMatchObject({ kind: "open", openKind: 0, closeKind: 2 });
  });

  it("switches TSLA to RedStone after the trial and pauses an uncovered lane", () => {
    const tsla = planSeries(series(), clock(MON.openSec - 60));
    expect(tsla).toMatchObject({ kind: "open", policyVersion: 1 });
    const qqq = planSeries(series({ key: "QQQ-5m", symbol: "QQQ", versions: QQQ }), clock(MON.openSec - 60));
    expect(qqq).toMatchObject({ kind: "paused", state: "paused: no signed source" });
    // The last Friday Window [19:55, 20:00] is still covered by v1 (validUntil inclusive).
    const lastFriday = planSeries(series({ key: "QQQ-5m", symbol: "QQQ", versions: QQQ, lastExpirySec: FRI.closeSec - 300 }), clock(FRI.closeSec - 350));
    expect(lastFriday).toMatchObject({ kind: "open", policyVersion: 0, closeKind: 2 });
  });

  it("lists nothing after the close, without a calendar, on a skip date, or without a free Book", () => {
    expect(planSeries(series(), clock(FRI.closeSec + 60)).state).toBe("closed: no session");
    expect(planSeries(series(), clock(FRI.openSec, { calendar: null })).kind).toBe("closed");
    const skips = [{ symbol: "TSLA" as const, date: "2026-09-25", why: "split" }];
    expect(planSeries(series(), clock(FRI.openSec, { skips })).state).toBe("paused: corporate action (split)");
    expect(planSeries(series({ freeBooks: [] }), clock(FRI.openSec)).state).toBe("waiting: no free book");
  });

  it("skips a late Window whose open print or check open can no longer be admitted (a late open would void or go single-source)", () => {
    // 60m 10:00–11:00 at 10:35: the open deadline (10:15) passed, so the next Window (11:00) is the candidate.
    const hour = planSeries(series({ key: "NVDA-60m", cadenceSec: 3_600, versions: NVDA }), clock(FRI.openSec + 1_800 + 2_100));
    expect(hour.kind === "wait" && hour.window.tradingStartSec).toBe(FRI.openSec + 5_400);
    // TSLA 15m with a RedStone check at T + 100: the check deadline (T + 120) is inside the 45 s margin, so skip it.
    const t = FRI.openSec + 900;
    const checked = planSeries(series({ cadenceSec: 900 }), clock(t + 100));
    expect(checked.kind === "wait" && checked.window.tradingStartSec).toBe(t + 900);
    // Without a check the same Window still opens late: the primary open is admitted until T + 900.
    const single = planSeries(series({ key: "NVDA-15m", cadenceSec: 900, versions: NVDA }), clock(t + 100));
    expect(single).toMatchObject({ kind: "open" });
  });
});
