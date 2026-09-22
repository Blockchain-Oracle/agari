"use client";

import { ET_WEEKDAY_SHORT, etDateOf, formatEtClock, weekdayOfDate } from "@agari/core/market";
import { marketsProvider } from "@agari/markets";
import { useSyncExternalStore } from "react";

/**
 * A boundary's time, for the person reading it.
 *
 * The venue keeps NYSE time: a Window opens at the bell, 09:30 ET, and core says so in ET because that is the fact
 * and core is pure. The reader is somewhere else — the complaint that opened this was "opens Tue 09:30 ET" shown
 * to someone in UTC+1 at 14:17 local, thirteen minutes before that bell, who read it as another day in another
 * country. So the web renders every such time in the viewer's zone first, with the ET fact kept beside it:
 * "14:30 (09:30 ET)" today, "Wed 14:30 (09:30 ET)" on another day, and plain "09:30 ET" for a reader in Eastern time.
 *
 * The zone is only known in a browser. On the server, and for the hydration render, the string is the ET text as
 * it always was, so the two renders match; the first client render after hydration carries the local time. The
 * countdown phrases ("opens in 13 min", `sessionPhrase`) need no zone and are untouched.
 */
export interface WhenOptions {
  /** "16:00:00" — a boundary with seconds (the Gap's prints). */
  seconds?: boolean;
  /** The clock alone, never a weekday: "as of 16:00 ET" style slots. */
  clock?: boolean;
  /** The clock that decides "today"; defaults to the chain-corrected one. */
  nowSec?: number;
}

const listeners = new Set<() => void>();
let zone: string | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (zone === null && typeof Intl !== "undefined") {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    if (zone) queueMicrotask(() => listeners.forEach((fn) => fn()));
  }
  return () => void listeners.delete(listener);
}

const getZone = () => zone;
const noZone = () => null;

/** The viewer's IANA zone once hydrated, else null. */
export function useViewerZone(): string | null {
  return useSyncExternalStore(subscribe, getZone, noZone);
}

const etText = (sec: number, seconds: boolean, clock: boolean): string => {
  const hhmm = formatEtClock(sec);
  const time = seconds ? `${hhmm}:${String(sec % 60).padStart(2, "0")}` : hhmm;
  return clock ? `${time} ET` : `${ET_WEEKDAY_SHORT[weekdayOfDate(etDateOf(sec))]} ${time} ET`;
};

function localParts(sec: number, tz: string, seconds: boolean): { time: string; day: string; date: string } {
  const at = new Date(sec * 1000);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" as const } : {}) }).format(at);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(at);
  // en-CA gives YYYY-MM-DD, a date that compares as text.
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  return { time, day, date };
}

/** The formatter for `tz` (null = ET text), a pure function of its inputs; `useWhen` binds it to the viewer. */
export function whenFor(tz: string | null): (sec: number, options?: WhenOptions) => string {
  return (sec, options = {}) => {
    const seconds = options.seconds ?? false;
    const clock = options.clock ?? false;
    if (!tz) return etText(sec, seconds, clock);
    const local = localParts(sec, tz, seconds);
    const et = etText(sec, seconds, true);
    // The same wall clock in both zones is the same zone for this purpose: say it once.
    if (`${local.time} ET` === et && local.date === etDateOf(sec)) return etText(sec, seconds, clock);
    const nowSec = options.nowSec ?? Math.floor(marketsProvider.nowMs() / 1000);
    const today = localParts(nowSec, tz, false).date === local.date;
    const etDay = ET_WEEKDAY_SHORT[weekdayOfDate(etDateOf(sec))];
    const etSide = etDay === local.day ? et : `${etDay} ${et}`;
    return `${clock || today ? "" : `${local.day} `}${local.time} (${etSide})`;
  };
}

/** `when(sec)` → "Wed 14:30 (09:30 ET)"; `when(sec, { clock: true })` → "14:30 (09:30 ET)"; ET text until hydrated. */
export function useWhen(): (sec: number, options?: WhenOptions) => string {
  return whenFor(useViewerZone());
}
