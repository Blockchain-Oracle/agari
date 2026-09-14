import { describe, expect, it } from "vitest";
import { calendarFromAlpaca } from "./calendar";
import { alpacaCalendar, LIVE_ALPACA_ROWS, LIVE_TSLA_SCHEDULE, utc } from "./calendar.fixtures";
import { etWallToUtcSec } from "./et-time";
import { agreeCalendars, parsePythSchedule, pythHoursOn } from "./pyth-schedule";
import { sessionLabel, sessionStatus } from "./session";
import { regularWindowsForCalendar } from "./windows";

describe("ET wall time", () => {
  it("converts across the 2026-11-01 DST switch", () => {
    expect(etWallToUtcSec("2026-10-30", 9 * 60 + 30)).toBe(utc("2026-10-30T13:30:00Z"));
    expect(etWallToUtcSec("2026-11-02", 9 * 60 + 30)).toBe(utc("2026-11-02T14:30:00Z"));
    // Four hours after the switch: a fixed "wall − 4 h" offset probe would land an hour early here.
    expect(etWallToUtcSec("2026-11-01", 5 * 60)).toBe(utc("2026-11-01T10:00:00Z"));
    // The ambiguous 01:30 resolves to the earlier (EDT) instant.
    expect(etWallToUtcSec("2026-11-01", 90)).toBe(utc("2026-11-01T05:30:00Z"));
  });
});

describe("Alpaca calendar", () => {
  it("reads the live row shape, including the 13:00 early close", () => {
    const calendar = calendarFromAlpaca(LIVE_ALPACA_ROWS, "2026-11-25", "2026-11-30");
    expect(calendar.sessions.map((s) => [s.date, s.earlyClose])).toEqual([
      ["2026-11-25", false],
      ["2026-11-27", true],
      ["2026-11-30", false],
    ]);
    expect(calendar.sessions[1]!.closeSec).toBe(utc("2026-11-27T18:00:00Z"));
  });
});

describe("Pyth schedule", () => {
  it("parses the live TSLA schedule", () => {
    const schedule = parsePythSchedule(LIVE_TSLA_SCHEDULE);
    expect(schedule.timeZone).toBe("America/New_York");
    expect(schedule.weekly.slice(0, 5)).toEqual(Array(5).fill([{ startMin: 570, endMin: 960 }]));
    expect(schedule.weekly.slice(5)).toEqual([[], []]);
    expect(schedule.overrides.size).toBe(12);
    expect(pythHoursOn(schedule, "2026-11-27")).toEqual([{ startMin: 570, endMin: 780 }]);
    expect(pythHoursOn(schedule, "2026-11-26")).toEqual([]);
    expect(() => parsePythSchedule("America/New_York;0930-1600,C")).toThrow();
  });

  it("agrees with Alpaca on real dates and lists nothing on a disagreement", () => {
    const alpaca = alpacaCalendar("2026-11-23", "2026-11-30");
    expect(agreeCalendars(alpaca, parsePythSchedule(LIVE_TSLA_SCHEDULE)).disagreements).toEqual([]);

    // A schedule missing the 11-27 early close says 16:00 while Alpaca says 13:00.
    const stale = parsePythSchedule(LIVE_TSLA_SCHEDULE.replace("1127/0930-1300,", ""));
    const { calendar, disagreements } = agreeCalendars(alpaca, stale);
    expect(disagreements.map((d) => d.date)).toEqual(["2026-11-27"]);
    expect(calendar.unknownDates).toEqual(["2026-11-27"]);
    const listedDates = regularWindowsForCalendar(calendar, 300).map((w) => new Date(w.tradingStartSec * 1000).toISOString().slice(0, 10));
    expect(listedDates).not.toContain("2026-11-27");
    expect(sessionStatus(utc("2026-11-27T16:00:00Z"), calendar)).toBeNull();
  });
});

describe("session status", () => {
  const calendar = alpacaCalendar("2026-11-23", "2026-12-04");

  it("calls Thanksgiving a holiday and points at Friday's open", () => {
    const status = sessionStatus(utc("2026-11-26T17:00:00Z"), calendar)!;
    expect(status.state).toBe("holiday");
    expect(status.nextOpenSec).toBe(utc("2026-11-27T14:30:00Z"));
    expect(sessionLabel(status)).toBe("Opens Fri 09:30 ET");
  });

  it("walks the early-close day from pre to closed", () => {
    const at = (iso: string) => sessionStatus(utc(iso), calendar)!;
    expect([at("2026-11-27T08:59:00Z").state, at("2026-11-27T09:00:00Z").state]).toEqual(["closed", "pre"]);
    const midday = at("2026-11-27T17:00:00Z");
    expect([midday.state, midday.earlyClose, sessionLabel(midday)]).toEqual(["early-close", true, "Closes 13:00 ET today"]);
    expect(at("2026-11-27T21:59:00Z").state).toBe("post");
    const evening = at("2026-11-27T22:00:00Z");
    expect([evening.state, sessionLabel(evening)]).toEqual(["closed", "Opens Mon 09:30 ET"]);
  });

  it("reports a halt only during regular hours", () => {
    expect(sessionStatus(utc("2026-11-30T15:00:00Z"), calendar, { halted: true })!.state).toBe("halted");
    const pre = sessionStatus(utc("2026-11-30T12:00:00Z"), calendar, { halted: true })!;
    expect([pre.state, pre.halted]).toEqual(["pre", true]);
  });
});
