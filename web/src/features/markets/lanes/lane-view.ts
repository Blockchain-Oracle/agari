/**
 * How a lane reads on every surface (session-lanes.md §5): its tab key and label, the asset it prices, its ET clock
 * words and its source note. Pure, so the cards, the hero, the ticket and the `/dev` fixtures say the same thing.
 */
import { basketOf, earningsEventFor, ET_WEEKDAY_SHORT, etDateOf, formatEtClock, haltLabel, TICKERS, weekdayOfDate, type TickerSymbol, tokenLaneAsset } from "@agari/core/market";
import { HALT_REASONS, type EarningsEvent, type EventMarket, type HaltReason, type LaneBasis } from "@agari/core/types";
import { formatCadence, HERO, LANE_STATE, MARKETS } from "@/lib/copy";

/** One lane per (basis, cadence), keyed as core `groupIntoLanes` keys it, so a 5m stock lane and a 5m token lane stay apart. */
export type LaneTabKey = `${LaneBasis}:${number}`;

export const laneTabKey = (basis: LaneBasis, intervalSec: number): LaneTabKey => `${basis}:${intervalSec}`;

const KEY_RE = /^(regular|gap|token):(\d+)$/;

/** A stored pin: `gap:604800`, or a bare number from before S6 (a Regular cadence). */
export function parseLaneTabKey(raw: string): LaneTabKey | null {
  if (/^\d+$/.test(raw)) return raw === "0" ? null : laneTabKey("regular", Number(raw));
  const match = KEY_RE.exec(raw);
  return match ? laneTabKey(match[1] as LaneBasis, Number(match[2])) : null;
}

export function laneTabParts(key: LaneTabKey): { basis: LaneBasis; intervalSec: number } {
  const [basis, interval] = key.split(":") as [LaneBasis, string];
  return { basis, intervalSec: Number(interval) };
}

const BASIS_ORDER: Record<LaneBasis, number> = { regular: 0, gap: 1, token: 2 };

/** Core's board order: the in-session lanes, then the Gap, then the 24/7 token lanes; shorter cadences first. */
export function compareLaneTabKeys(a: LaneTabKey, b: LaneTabKey): number {
  const x = laneTabParts(a);
  const y = laneTabParts(b);
  return BASIS_ORDER[x.basis] - BASIS_ORDER[y.basis] || x.intervalSec - y.intervalSec;
}

/** `5m`, `1h`, `Gap`, `5m · 24/7`. */
export function laneTabLabel(basis: LaneBasis, intervalSec: number): string {
  if (basis === "gap") return LANE_STATE.tab.gap;
  const cadence = formatCadence(intervalSec);
  return basis === "token" ? LANE_STATE.tab.token(cadence) : cadence;
}

/** The asset a Window prices: the xStock on the token lane ("TSLAx"), the ticker elsewhere. */
export function laneAssetLabel(asset: TickerSymbol, basis: LaneBasis): string {
  return basis === "token" ? (tokenLaneAsset(asset) ?? asset) : asset;
}

/** A card's cadence chip: `5m` · `Gap` · `5m` (the token card already says "TSLAx"). */
export const laneCadenceLabel = (basis: LaneBasis, intervalSec: number): string => (basis === "gap" ? LANE_STATE.tab.gap : formatCadence(intervalSec));

/** "16:00:00": an ET wall clock with seconds (ET offsets are whole minutes, so the seconds are UTC's). */
export const etClockSec = (sec: number): string => `${formatEtClock(sec)}:${String(sec % 60).padStart(2, "0")}`;

/** "Fri 16:00", or "Mon 09:30:00" with seconds: ET wall text for a boundary. */
export function etWhen(sec: number, withSeconds = false): string {
  const weekday = ET_WEEKDAY_SHORT[weekdayOfDate(etDateOf(sec))];
  return `${weekday} ${withSeconds ? etClockSec(sec) : formatEtClock(sec)}`;
}

export const etWeekday = (sec: number): string => ET_WEEKDAY_SHORT[weekdayOfDate(etDateOf(sec))];

/**
 * The hero's settlement basis note (M `PriceSourceNote`): what decides this Window, in one line. A 24/7 Window's source
 * is its asset's kind, not the lane: an xStock settles on Switchboard, a pre-IPO name on the PreStocks read the venue
 * signs (D-101), a basket on its index (S19). Before this every token-basis Window, `OPENAI-60m` included, was given
 * the Switchboard line.
 */
export function priceSourceLine(market: Pick<EventMarket, "asset" | "lane" | "tradingStartSec" | "expirySec">): string {
  if (market.lane === "gap") return LANE_STATE.source.gap(etWhen(market.tradingStartSec, true), etWhen(market.expirySec, true));
  if (market.lane === "token") {
    const ticker = TICKERS[market.asset];
    const basket = basketOf(market.asset);
    if (basket) return LANE_STATE.source.basket(basket.name, basket.members.map((m) => TICKERS[m.symbol].name).join(", "));
    if (ticker.kind === "preIpo") return LANE_STATE.source.preIpo(ticker.name);
    return LANE_STATE.source.token(laneAssetLabel(market.asset, "token"));
  }
  return HERO.source;
}

/** Core `haltPausedState`: `paused: halted (<reason>)`. */
const HALTED_STATE = /^paused: halted \(([a-z-]+)\)/;

/**
 * A roller `paused: …` state → the card's headline and why (no source, corporate action, or a halt). The why names the
 * lane as a reader would: "No 5m TSLA Window", "No QQQ Gap Window".
 */
export function pausedCopy(state: string, asset: string, basis: LaneBasis, intervalSec: number): { headline: string; why: string } {
  const [lead, tail] = basis === "gap" ? [`${asset} ${LANE_STATE.tab.gap}`, ""] : [asset, laneCadenceLabel(basis, intervalSec)];
  const reason = HALTED_STATE.exec(state)?.[1];
  if (reason && (HALT_REASONS as readonly string[]).includes(reason)) {
    return { headline: haltLabel(reason as HaltReason), why: LANE_STATE.haltWhy(lead, tail) };
  }
  const corporate = state.startsWith("paused: corporate action");
  return { headline: corporate ? MARKETS.paused.corporateAction : MARKETS.paused.noSource, why: tail ? MARKETS.paused.why(lead, tail) : LANE_STATE.pausedWhy(lead) };
}

/**
 * The earnings line for a Window: core `earningsEventFor` decides (a Regular Window on a report date, a Gap over an
 * after-close Friday or a before-open Monday; token Windows never); this is only its words. Null events = unknown.
 */
export function earningsWarning(market: Pick<EventMarket, "asset" | "lane" | "tradingStartSec" | "expirySec">, events: readonly EarningsEvent[] | null): string | null {
  const hit = events ? earningsEventFor(market.asset, market, events) : null;
  if (!hit) return null;
  const { hour } = hit.event;
  if (hit.flag === "earnings-session") {
    return LANE_STATE.earnings.session(market.asset, hour ? `${LANE_STATE.earnings.hour[hour]} ${LANE_STATE.earnings.today}` : LANE_STATE.earnings.today);
  }
  const friday = hour === "amc";
  return LANE_STATE.earnings.gap(market.asset, `${LANE_STATE.earnings.hour[friday ? "amc" : "bmo"]} ${etWeekday(friday ? market.tradingStartSec : market.expirySec)}`);
}
