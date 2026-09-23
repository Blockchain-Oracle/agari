import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from "react-native-reanimated";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { Glyph } from "../strategies/Glyph";

export type StepState = "idle" | "active" | "done";

/**
 * web's features/x/StepSpine.tsx Step: a numbered node on a spine whose segment fills once the flow has moved past
 * it; the active card is raised, an idle one dimmed.
 */
export function Step({ n, title, state, filled, last, children }: {
  n: number;
  title: string;
  state: StepState;
  /** The flow has moved past this step. */
  filled: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const fill = useAnimatedStyle(() => ({ height: withTiming(filled ? "100%" : "0%", { duration: reduce ? 0 : 420 }) }));
  const done = state === "done";
  const active = state === "active";
  return (
    <View style={styles.step} accessibilityLabel={`Step ${n}, ${title}, ${done ? "done" : active ? "current" : "not yet"}`}>
      <View style={styles.rail}>
        <View
          style={[
            styles.node,
            {
              borderColor: done ? color.profit : active ? color.accent : color.hairline,
              backgroundColor: done ? color.profitWash : active ? color.accentWash : color.surface1,
            },
          ]}
        >
          {done ? <Glyph name="check" size={13} tint={color.profit} /> : <Text style={[TYPE.data, { color: active ? color.accent : color.inkMuted }]}>{n}</Text>}
        </View>
        {last ? null : (
          <View style={[styles.spine, { backgroundColor: color.hairline }]}>
            <Animated.View style={[styles.spineFill, { backgroundColor: color.profit }, fill]} />
          </View>
        )}
      </View>
      <View
        style={[
          styles.card,
          { borderColor: active ? color.accentDim : color.hairline, backgroundColor: color.surface1, opacity: state === "idle" ? 0.6 : 1 },
        ]}
      >
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 12 },
  rail: { alignItems: "center", width: 30 },
  node: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  spine: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1, overflow: "hidden" },
  spineFill: { width: 2 },
  card: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14, gap: 10, marginBottom: 12 },
});
