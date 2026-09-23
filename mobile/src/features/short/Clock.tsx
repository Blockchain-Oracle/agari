import { SETTLING } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import { formatClock } from "@agari/core/units";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { TYPE, useTheme } from "~/theme";

const PLACEHOLDER = "–:––";

/**
 * web's `components/data/Countdown.tsx`: the Window's time left from the chain-corrected clock, "Settling" once it
 * has closed, the accent ink in its urgent last stretch. The parent's `nowMs` ticks it, so nothing here polls.
 */
export function Clock({ expirySec, intervalSec, nowMs, style }: {
  expirySec: number;
  intervalSec: number;
  nowMs: number;
  style?: StyleProp<TextStyle>;
}) {
  const { color } = useTheme();
  const state = nowMs > 0 ? countdown(nowMs, expirySec, intervalSec) : null;
  const text = state ? (state.settling ? SETTLING : formatClock(state.remainingSec)) : PLACEHOLDER;
  return (
    <Text
      accessibilityRole="timer"
      style={[TYPE.data, { color: state?.urgent ? color.accent : color.ink }, style]}
    >
      {text}
    </Text>
  );
}
