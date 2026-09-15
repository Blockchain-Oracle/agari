import { sessionAt, type SessionCalendar } from "@agari/core/market";
import { describe, expect, it } from "vitest";
import { planSeries, spanOf, type PlanClock, type PlanSeries } from "./plan";
import type { VersionWindow } from "./versions";

// Fri 2026-09-25 (regular), Mon 09-28, Tue 09-29 and Wed 09-30; 09-26/27 closed. EDT: 09:30 ET = 13:30Z, 16:00 ET = 20:00Z.
const FRI = sessionAt("2026-09-25", 570, 960);
const MON = sessionAt("2026-09-28", 570, 960);
const TUE = sessionAt("2026-09-29", 570, 960);
const WED = sessionAt("2026-09-30", 570, 960);
const CALENDAR: SessionCalendar = { fromDate: "2026-09-21", toDate: "2026-10-09", sessions: [FRI, MON, TUE, WED], unknownDates: [] };
const TRIAL_END = FRI.closeSec;
const TSLA: VersionWindow[] = [
  { validFromSec: FRI.openSec - 86_400 * 14, validUntilSec: TRIAL_END, primarySource: 1, checkSource: 2, openAdmissionSec: 900, checkAdmissionSec: 120 },
  { validFromSec: TRIAL_END, validUntilSec: null, primarySource: 2, checkSource: 0, openAdmissionSec: 900, checkAdmissionSec: 0 },
];
const QQQ: VersionWindow[] = [TSLA[0]!];
const NVDA: VersionWindow[] = [{ validFromSec: 0, validUntilSec: null, primarySource: 2, checkSource: 0, openAdmissionSec: 900, checkAdmissionSec: 0 }];

const series = (over: Partial<PlanSeries> = {}): PlanSeries => ({
  key: "TSLA-5m", symbol: "TSLA", cadenceSec: 300, maxLeadSec: 400_000, nextIndex: 7n, lastExpirySec: 0, versions: TSLA, freeBooks: ["BookA", "BookB"], ...over,
});
const clock = (nowSec: number, over: Partial<PlanClock> = {}): PlanClock => ({ calendar: CALENDAR, nowSec, leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, skips: [], multipliers: [], halts: {}, prelist: true, prelistCadencesSec: [300, 900, 3_600], ...over });

describe("window-roller plan", () => {
  it("opens the session's first Window within the lead, as SessionOpen on the covering trial version", () => {
    const plan = planSeries(series(), clock(FRI.openSec - 100));
    expect(plan).toMatchObject({ kind: "open", index: 7n, policyVersion: 0, openKind: 1, closeKind: 0, book: "BookA" });
    if (plan.kind === "open") expect(plan.window.tradingStartSec).toBe(FRI.openSec);
  });

  it("waits outside the lead and reports closed before the session (ROLLER_PRELIST off)", () => {
    expect(planSeries(series(), clock(FRI.openSec - 3_600, { prelist: false }))).toMatchObject({ kind: "wait", wakeSec: FRI.openSec - 120, state: "closed: no session" });
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
    expect(planSeries(series(), clock(FRI.closeSec + 60, { prelist: false })).state).toBe("closed: no session");
    expect(planSeries(series(), clock(FRI.openSec, { calendar: null })).kind).toBe("closed");
    const skips = [{ symbol: "TSLA" as const, date: "2026-09-25", why: "split" }];
    expect(planSeries(series(), clock(FRI.openSec, { skips })).state).toBe("paused: corporate action (split)");
    expect(planSeries(series({ freeBooks: [] }), clock(FRI.openSec)).state).toBe("waiting: no free book");
    const halts = { TSLA: { reason: "pyth-wide" as const, sinceSec: FRI.openSec - 30 } };
    expect(planSeries(series(), clock(FRI.openSec, { halts })).state).toBe("paused: halted (pyth-wide)");
    expect(planSeries(series(), clock(FRI.openSec, { halts: { NVDA: halts.TSLA } })).kind).toBe("open");
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

// D-089: a Series' first Window of the next session lists at the previous close, so users can rest pre-open calls on it.
describe("window-roller prelist", () => {
  const nvda = (over: Partial<PlanSeries> = {}) => series({ key: "NVDA-5m", symbol: "NVDA", versions: NVDA, lastExpirySec: TUE.closeSec, ...over });

  it("lists Wednesday's first Window at Tuesday's close: 13:30Z on 5m and 15m, 14:00Z on 60m", () => {
    for (const [cadenceSec, startSec] of [[300, WED.openSec], [900, WED.openSec], [3_600, WED.openSec + 1_800]] as const) {
      const plan = planSeries(nvda({ key: `NVDA-${cadenceSec / 60}m`, cadenceSec }), clock(TUE.closeSec));
      expect(plan, `${cadenceSec}`).toMatchObject({ kind: "open", index: 7n, policyVersion: 0, book: "BookA" });
      expect(plan.kind === "open" && plan.window.tradingStartSec).toBe(startSec);
      expect(plan.state.startsWith("prelisting #7"), plan.state).toBe(true);
    }
  });

  it("lists Monday's first Window at Friday's close, three days ahead", () => {
    const plan = planSeries(nvda({ lastExpirySec: FRI.closeSec }), clock(FRI.closeSec));
    expect(plan.kind === "open" && plan.window.tradingStartSec).toBe(MON.openSec);
    expect(plan.state).toContain("prelisting");
  });

  it("never prelists while a session is trading: it waits for the close", () => {
    const midSession = TUE.openSec + 5_400;
    const plan = planSeries(nvda(), clock(midSession));
    expect(plan).toMatchObject({ kind: "wait", wakeSec: TUE.closeSec, state: `waiting: lists at the close for ${spanOf({ tradingStartSec: WED.openSec, expirySec: WED.openSec + 300 })}` });
  });

  it("waits out the Series' own horizon when it can't reach the Window yet", () => {
    // max_lead_sec 86,400 at Friday's close: Monday's open is 65 h away, so listing starts 24 h before it, less the margin.
    const plan = planSeries(nvda({ lastExpirySec: FRI.closeSec, maxLeadSec: 86_400 }), clock(FRI.closeSec));
    expect(plan).toMatchObject({ kind: "wait", wakeSec: MON.openSec - 86_400 + 3_600 });
    expect(plan.state).toContain("waiting: lists at the close");
    // One second after that wake, it lists.
    expect(planSeries(nvda({ lastExpirySec: FRI.closeSec, maxLeadSec: 86_400 }), clock(MON.openSec - 82_800)).state).toContain("prelisting");
  });

  it("keeps the ordinary lead for every later Window of the session", () => {
    const second = { tradingStartSec: WED.openSec + 300, expirySec: WED.openSec + 600 };
    const listed = nvda({ lastExpirySec: WED.openSec + 300 });
    expect(planSeries(listed, clock(WED.openSec + 120))).toMatchObject({ kind: "wait", state: `waiting: next ${spanOf(second)}` });
    expect(planSeries(listed, clock(WED.openSec + 180)).state).toContain("opening #7");
  });

  it("runs the halt, corporate, version and Book checks on the prelist path, and honours the cadence filter", () => {
    const halts = { NVDA: { reason: "redstone-stale" as const, sinceSec: TUE.closeSec - 90 } };
    expect(planSeries(nvda(), clock(TUE.closeSec, { halts })).state).toBe("paused: halted (redstone-stale)");
    const skips = [{ symbol: "NVDA" as const, date: "2026-09-30", why: "split" }];
    expect(planSeries(nvda(), clock(TUE.closeSec, { skips })).state).toBe("paused: corporate action (split)");
    expect(planSeries(nvda({ freeBooks: [] }), clock(TUE.closeSec)).state).toBe("waiting: no free book");
    // QQQ's trial version ended at the Friday close, so Wednesday has no covering version.
    expect(planSeries(nvda({ key: "QQQ-5m", symbol: "QQQ", versions: QQQ }), clock(TUE.closeSec)).state).toBe("paused: no signed source");
    // ROLLER_PRELIST_CADENCES=300: the 60m lane waits instead.
    expect(planSeries(nvda({ key: "NVDA-60m", cadenceSec: 3_600 }), clock(TUE.closeSec, { prelistCadencesSec: [300] })).state).toBe("closed: no session");
    expect(planSeries(nvda(), clock(TUE.closeSec, { prelist: false })).state).toBe("closed: no session");
  });
});
