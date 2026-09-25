import { countdown, type MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import { Text } from "react-native";
import { LANE_STATE, SETTLING } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { useTheme } from "~/theme";
import { lanesTokens } from "~/theme/web/markets-lanes";
import { card } from "./card-styles";

/** A Gap Window that far from its lock names the lock instead of counting fifty hours down. */
const GAP_COUNTDOWN_FROM_SEC = 3_600;
/** web Countdown's placeholder before the first clock tick. */
const PLACEHOLDER = "–:––";

/** web's components/data Countdown inside `.mc-countdown`: `m:ss` to the bell, "Settling" at it, the placeholder before a tick. */
export function WindowCountdown({ expirySec, intervalSec, nowMs }: { expirySec: number; intervalSec: number; nowMs: number }) {
  const { name } = useTheme();
  const state = nowMs > 0 ? countdown(nowMs, expirySec, intervalSec) : null;
  return (
    <Text style={[card.countdownText, { color: lanesTokens(name).vermilion }]} accessibilityRole="timer">
      {state ? (state.settling ? SETTLING : formatClock(state.remainingSec)) : PLACEHOLDER}
    </Text>
  );
}

/**
 * The card's clock — web MarketCardView's `GapClock` for a Gap (it names the lock, then the settle, until the last
 * hour, then counts it down; a settled Gap says so), the Window's countdown for every other lane.
 */
export function CardClock({ market, nowMs, current }: { market: EventMarket; nowMs: number; current: MarketPhase | null }) {
  const { name } = useTheme();
  const when = useWhen();
  const ink = { color: lanesTokens(name).vermilion };
  if (market.lane !== "gap") return <WindowCountdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />;
  if (current === "settledUnclaimed" || current === "finalized" || current === "voided") return <Text style={[card.countdownText, ink]}>{LANE_STATE.gap.settledClock}</Text>;
  const nowSec = Math.floor(nowMs / 1000);
  const target = nowSec < market.lockAtSec ? market.lockAtSec : market.expirySec;
  if (nowMs === 0 || target - nowSec > GAP_COUNTDOWN_FROM_SEC) {
    return (
      <Text style={[card.countdownText, ink]} numberOfLines={1}>
        {target === market.lockAtSec ? LANE_STATE.gap.locks(when(market.lockAtSec)) : LANE_STATE.gap.settles(when(market.expirySec))}
      </Text>
    );
  }
  return <WindowCountdown expirySec={target} intervalSec={GAP_COUNTDOWN_FROM_SEC} nowMs={nowMs} />;
}
