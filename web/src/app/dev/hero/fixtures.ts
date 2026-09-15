/**
 * Canned closed-market heroes (S18a, D-086/D-087): the same `MarketSession` a live `/session` read builds, at the
 * `/dev/session` clocks, over a signed-archive-shaped 5-minute series, so the asset hero, the ticket placeholder, the
 * next-Window card and the chip are provable while NYSE is open. Prints are × 10⁻⁸ (the print scale); no floats.
 */
import type { TickerSymbol } from "@agari/core/market";
import { archiveWindow, type AssetHistory } from "@/features/markets/asset-history";
import type { ChartPoint } from "@/features/markets/hero";
import type { MarketSession } from "@/features/markets/session";
import { CLOCK, fixtureSession } from "../session/market-session-fixtures";

const ASSET: TickerSymbol = "TSLA";
const FIVE_MIN = 300;

/** TSLA at the print scale: the previous close, the session's open and close, and two moved extended-hours ticks. */
const PREV_CLOSE = 36_219_000_000n; // $362.19
const OPEN = 36_000_000_000n; // $360.00
const LAST_CLOSE = 35_907_000_000n; // $359.07
const PRE_TICK = 35_710_000_000n; // $357.10 — pre-market, down since the close
const POST_TICK = 36_055_000_000n; // $360.55 — after hours, up since the close

/** One point per 5-minute boundary from the open to the close, a straight drift with a slow deterministic swing. */
function sessionPrints(openSec: number, closeSec: number, fromRaw: bigint, toRaw: bigint): ChartPoint[] {
  const n = Math.floor((closeSec - openSec) / FIVE_MIN);
  return Array.from({ length: n + 1 }, (_, i) => {
    const drift = ((toRaw - fromRaw) * BigInt(i)) / BigInt(n);
    const wobble = BigInt(Math.abs((i % 24) - 12) - 6) * 15_000_000n; // a slow triangle, ± $0.90
    return { timeSec: openSec + i * FIVE_MIN, valueRaw: i === n ? toRaw : fromRaw + drift + wobble };
  });
}

interface HistoryOptions {
  /** A moved extended-hours tick after the close; absent = the last close is the latest point. */
  tick?: { sec: number; raw: bigint };
  /** The archive starts with this session: no previous close, the open stands in as the line. */
  firstSession?: boolean;
}

/** The 1D history `useAssetHistory` would build at `nowSec` over this session's calendar. */
function history(session: MarketSession, nowSec: number, { tick, firstSession = false }: HistoryOptions = {}): AssetHistory {
  const window = archiveWindow(session.sessions, nowSec);
  if (!window) throw new Error(`no completed session before ${nowSec}`);
  const prints = sessionPrints(window.session.openSec, window.session.closeSec, OPEN, LAST_CLOSE);
  const points = tick ? [...prints, { timeSec: tick.sec, valueRaw: tick.raw }] : prints;
  const open = prints[0]!;
  const prev = firstSession || !window.prev ? null : { sec: window.prev.closeSec, priceRaw: PREV_CLOSE };
  return {
    range: "1D",
    points,
    latest: points.at(-1) ?? null,
    lastClose: { sec: window.session.closeSec, priceRaw: LAST_CLOSE },
    prevClose: prev ?? { sec: open.timeSec, priceRaw: open.valueRaw },
    lineIsOpen: prev === null,
    session: window.session,
    liveSec: tick?.sec ?? null,
  };
}

export interface HeroFixture {
  label: string;
  asset: TickerSymbol;
  session: MarketSession;
  nowSec: number;
  history: AssetHistory;
}

const at = (label: string, nowSec: number, options?: HistoryOptions): HeroFixture => {
  const session = fixtureSession(nowSec);
  return { label, asset: ASSET, session, nowSec, history: history(session, nowSec, options) };
};

/** The four closed states the stage names: pre-market, after hours, the weekend, a holiday. */
export const HERO_FIXTURES: readonly HeroFixture[] = [
  at("pre-market — Tue 08:00 ET, a moved pre-market tick since the close", CLOCK.preTue, { tick: { sec: CLOCK.preTue - 120, raw: PRE_TICK } }),
  at("after hours — Tue 17:00 ET, a moved after-hours tick", CLOCK.postTue, { tick: { sec: CLOCK.postTue - 300, raw: POST_TICK } }),
  at("weekend — Sat 11:01 ET, the last close stands", CLOCK.weekendSat),
  at("holiday — Thanksgiving 11:00 ET, the archive starts with this session (open as the line)", CLOCK.holidayThu, { firstSession: true }),
];

/** The lanes the next-Window cards are drawn for: 5m and 60m, so the 10:00 first Window of the hour lane is visible. */
export const NEXT_WINDOW_CADENCES = [300, 3_600] as const;
