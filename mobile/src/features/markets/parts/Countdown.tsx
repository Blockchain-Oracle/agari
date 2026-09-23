import { countdown } from "@agari/core/lifecycle";
import { formatClock } from "@agari/core/units";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { TYPE, useTheme } from "~/theme";

/**
 * web's components/data Countdown: `m:ss` (or `h:mm:ss`) to a Window's bell, vermilion once core's `countdown` calls
 * it urgent for the cadence. `nowMs` is the chain-corrected clock; 0 before its first tick reads "—".
 */
export function Countdown({ expirySec, intervalSec, nowMs, style }: { expirySec: number; intervalSec: number; nowMs: number; style?: StyleProp<TextStyle> }) {
  const { color } = useTheme();
  if (nowMs <= 0) {
    return <Text style={[TYPE.data, { color: color.inkMuted }, style]}>—</Text>;
  }
  const state = countdown(nowMs, expirySec, intervalSec);
  return (
    <Text style={[TYPE.data, { color: state.urgent ? color.accent : color.ink }, style]} accessibilityRole="timer">
      {formatClock(state.remainingSec)}
    </Text>
  );
}
