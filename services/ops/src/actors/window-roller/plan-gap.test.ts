import { readFileSync } from "node:fs";
import { addDays, calendarFromAlpaca, datesBetween, etDateOf, weekdayOfDate, type SessionCalendar } from "@agari/core/market";
import { policyVersions, type PriceSources } from "@agari/markets/deploy";
import { describe, expect, it } from "vitest";
import type { PlanClock, PlanSeries } from "./plan";
import { planGapSeries } from "./plan-gap";
import { versionWindow } from "./versions";

// The real D-003 versions, as `init-gap-series` registers them (session-lanes.md §1.2).
const SOURCES = JSON.parse(readFileSync(new URL("../../../config/price-sources.json", import.meta.url), "utf8")) as PriceSources;
const NINE = ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL", "QQQ", "VOO"] as const;
const utc = (iso: string) => Date.parse(iso) / 1000;
const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(".000", "");

/** An agreed calendar like `SessionService`'s (7 days back, 14 ahead): NYSE weekdays minus `holidays`. */
function calendarAt(atSec: number, holidays: string[] = ["2026-09-07", "2026-11-26", "2026-12-25"], early: string[] = ["2026-11-27", "2026-12-24"]): SessionCalendar {
  const [from, to] = [addDays(etDateOf(atSec), -7), addDays(etDateOf(atSec), 14)];
  const rows = datesBetween(from, to)
    .filter((d) => weekdayOfDate(d) < 5 && !holidays.includes(d))
    .map((date) => ({ date, open: "09:30", close: early.includes(date) ? "13:00" : "16:00" }));
  return calendarFromAlpaca(rows, from, to);
}

const gapSeries = (symbol: string, over: Partial<PlanSeries> = {}): PlanSeries => ({
  key: `${symbol}-gap`, symbol, cadenceSec: 604_800, nextIndex: 0n, lastExpirySec: 0,
  versions: policyVersions(symbol, SOURCES, "gap").map(versionWindow), freeBooks: ["GapBook"], ...over,
});
const clock = (at: string, over: Partial<PlanClock> = {}): PlanClock => ({
  calendar: calendarAt(utc(at)), nowSec: utc(at), leadSec: 120, gapLeadSec: 172_800, minTradableSec: 60, skips: [], ...over,
});
const spanOf = (plan: ReturnType<typeof planGapSeries>) => ("window" in plan ? [iso(plan.window.tradingStartSec), iso(plan.window.lockAtSec), iso(plan.window.expirySec)] : null);

const GAP_0918 = ["2026-09-18T20:00:00Z", "2026-09-21T00:00:00Z", "2026-09-21T13:30:00Z"];

describe("window-roller Gap plan", () => {
  it("lists the 09-18 Gap on all nine Series from Wednesday 16:00 ET, on v1, SessionClose → SessionOpen", () => {
    for (const symbol of NINE) {
      const plan = planGapSeries(gapSeries(symbol), clock("2026-09-17T20:00:00Z"));
      expect(plan, symbol).toMatchObject({ kind: "open", index: 0n, policyVersion: 0, openKind: 2, closeKind: 1, book: "GapBook" });
      expect(spanOf(plan)).toEqual(GAP_0918);
    }
    const early = planGapSeries(gapSeries("TSLA"), clock("2026-09-16T19:59:59Z"));
    expect(early).toMatchObject({ kind: "wait", wakeSec: utc("2026-09-16T20:00:00Z"), state: "waiting: lists 09-16 20:00Z for 09-18 20:00Z–09-21 13:30Z" });
    expect(planGapSeries(gapSeries("TSLA"), clock("2026-09-16T20:00:00Z")).kind).toBe("open");
  });

  it("puts the 09-25 Gap on TSLA v2 (RedStone) and pauses QQQ/VOO, whose Pyth trial ends at its opening print", () => {
    const at = clock("2026-09-24T20:00:00Z");
    const tsla = planGapSeries(gapSeries("TSLA", { lastExpirySec: utc(GAP_0918[2]!) }), at);
    expect(tsla).toMatchObject({ kind: "open", policyVersion: 1 });
    expect(tsla.state).toContain("v2 redstone");
    for (const symbol of ["QQQ", "VOO"]) expect(planGapSeries(gapSeries(symbol), at)).toMatchObject({ kind: "paused", state: "paused: no signed source" });
    expect(planGapSeries(gapSeries("NVDA"), at)).toMatchObject({ kind: "open", policyVersion: 0 });
  });

  it("opens the Thanksgiving Gap at the 11-27 13:00 ET early close and crosses the Thursday holiday lead", () => {
    const plan = planGapSeries(gapSeries("NVDA"), clock("2026-11-25T18:00:00Z"));
    expect(plan).toMatchObject({ kind: "open", openKind: 2, closeKind: 1 });
    expect(spanOf(plan)).toEqual(["2026-11-27T18:00:00Z", "2026-11-30T01:00:00Z", "2026-11-30T14:30:00Z"]);
    expect(planGapSeries(gapSeries("NVDA"), clock("2026-11-25T17:59:59Z")).kind).toBe("wait");
  });

  it("runs a synthetic holiday Monday to the Tuesday open, and a corporate skip on either end pauses it", () => {
    const at = "2026-10-08T20:00:00Z";
    const holiday = { calendar: calendarAt(utc(at), ["2026-10-12"]) };
    const plan = planGapSeries(gapSeries("AAPL"), clock(at, holiday));
    expect(spanOf(plan)).toEqual(["2026-10-09T20:00:00Z", "2026-10-12T00:00:00Z", "2026-10-13T13:30:00Z"]);
    const skip = (date: string, lanes?: Array<"regular" | "gap" | "token">) => planGapSeries(gapSeries("AAPL"), clock(at, { ...holiday, skips: [{ symbol: "AAPL", date, why: "split", lanes }] }));
    expect(skip("2026-10-09")).toMatchObject({ kind: "paused", state: "paused: corporate action (split)" });
    expect(skip("2026-10-13")).toMatchObject({ kind: "paused", state: "paused: corporate action (split)" });
    expect(skip("2026-10-13", ["regular"]).kind).toBe("open");
    expect(skip("2026-10-12").kind).toBe("open");
  });

  it("lists a Gap past its check bound (single-source), but never one that can't take its opening print", () => {
    // TSLA v1 has a RedStone check (T + 120). A Regular Window would skip; a Gap lists, because the next is a week away.
    expect(planGapSeries(gapSeries("TSLA"), clock("2026-09-18T20:05:00Z"))).toMatchObject({ kind: "open", policyVersion: 0 });
    // 50 s before the Sunday lock: under a minute tradable, so the candidate is the next weekend (outside the lead).
    const late = planGapSeries(gapSeries("TSLA"), clock("2026-09-20T23:59:10Z"));
    expect(late.kind === "wait" && iso(late.window.tradingStartSec)).toBe("2026-09-25T20:00:00Z");
    // Back-to-back: once the 09-18 Window is listed, the next candidate is the 09-25 weekend.
    expect(planGapSeries(gapSeries("TSLA", { lastExpirySec: utc(GAP_0918[2]!) }), clock("2026-09-19T12:00:00Z")).kind).toBe("wait");
  });

  it("lists nothing without a calendar, with an unknown weekend date, or without a free Book", () => {
    expect(planGapSeries(gapSeries("TSLA"), clock("2026-09-17T20:00:00Z", { calendar: null })).state).toBe("closed: no calendar");
    const unknown = { ...calendarAt(utc("2026-09-17T20:00:00Z")), unknownDates: ["2026-09-21"] };
    expect(planGapSeries(gapSeries("TSLA"), clock("2026-09-17T20:00:00Z", { calendar: unknown })).kind).not.toBe("open");
    expect(planGapSeries(gapSeries("TSLA", { freeBooks: [] }), clock("2026-09-17T20:00:00Z")).state).toBe("waiting: no free book");
  });
});
