import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { FONT, useTheme } from "~/theme";

/** The last stretch the ring turns vermilion for (the plan's Window screen). */
const HOT_SEC = 30;

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Time left in a Window as a ring that empties toward the close, vermilion in the last 30 s. */
export function CountdownRing({ remainingSec, totalSec, size = 64 }: { remainingSec: number; totalSec: number; size?: number }) {
  const { color } = useTheme();
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const share = totalSec > 0 ? Math.min(Math.max(remainingSec / totalSec, 0), 1) : 0;
  const hot = remainingSec <= HOT_SEC;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="timer" accessibilityLabel={`${mmss(remainingSec)} left`}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.hairline} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={hot ? color.accent : color.ink}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - share)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.time, { color: hot ? color.accent : color.ink, fontSize: size * 0.24 }]}>{mmss(remainingSec)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  time: { fontFamily: FONT.dataStrong, fontVariant: ["tabular-nums"] },
});
