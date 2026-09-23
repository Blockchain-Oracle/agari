import { SymbolView } from "expo-symbols";
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { TONE_ICON, toneInk, toneWash, type NodeTone } from "./tone";

/**
 * The desk kit's sequences, from web/src/components/ui/desk-kit/timeline.tsx: the studio's progress
 * (21st Step Onboarding Wizard #29526, square numbered steps on a rail) and the record's rail
 * (21st Activity Timeline #28340: day-grouped nodes joined by a line).
 */
export interface StepItem {
  label: string;
  hint?: string;
}

// 21st: ziegfiroyt/onboarding9
/** Numbered steps joined by a progress rail; done steps show a check and can be revisited, later ones cannot. */
export function StepProgress({ steps, current, onPick, label }: { steps: readonly StepItem[]; current: number; onPick: (step: number) => void; label: string }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const fraction = steps.length > 1 ? (current - 1) / (steps.length - 1) : 0;
  const fill = useSharedValue(fraction);
  useEffect(() => {
    fill.value = reduce ? fraction : withTiming(fraction, { duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [fraction, reduce, fill]);
  const railFill = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const now = steps[current - 1];
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 1, max: steps.length, now: current }} style={styles.steps}>
      <View style={styles.stepRow}>
        <View style={[styles.rail, { backgroundColor: color.hairline }]}>
          <Animated.View style={[styles.railFill, { backgroundColor: color.accent }, railFill]} />
        </View>
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "next";
          const bg = state === "next" ? color.surface1 : color.accent;
          return (
            <Pressable
              key={s.label}
              disabled={state !== "done"}
              onPress={() => {
                haptic.select();
                onPick(n);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${String(n).padStart(2, "0")} ${s.label}${state === "done" ? ", done" : state === "current" ? ", current step" : ""}`}
              accessibilityState={{ disabled: state !== "done", selected: state === "current" }}
              hitSlop={10}
              style={[styles.badge, { backgroundColor: bg, borderColor: state === "next" ? color.borderStrong : color.accent }]}
            >
              {state === "done" ? (
                <SymbolView name={{ ios: "checkmark", android: "check" }} size={13} tintColor={color.onAccent} weight="bold" />
              ) : (
                <Text style={[styles.badgeText, { color: state === "next" ? color.inkMuted : color.onAccent }]}>{n}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {now ? (
        <View style={styles.stepCaption}>
          <Text style={[TYPE.labelMicro, { color: color.accent }]}>
            {String(current).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
            {now.hint ? ` · ${now.hint}` : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// 21st: 7ovr/timeline-3
/** A day label on the rail ("Today", "Yesterday", "Mon 21 Sep"). */
export function TimelineDay({ children }: { children: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.day}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]} accessibilityRole="header">
        {children}
      </Text>
    </View>
  );
}

/** One node: its verdict's icon in a ring on the rail, the entry beside it; rises in, one after another. */
export function TimelineNode({ tone, index = 0, last = false, icon, children }: { tone: NodeTone; index?: number; last?: boolean; icon?: { ios: string; android: string }; children: ReactNode }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const ink = toneInk(tone, color);
  const entering = reduce ? undefined : FadeInDown.duration(300).delay(Math.min(index, 10) * 35);
  return (
    <Animated.View entering={entering} style={styles.node}>
      <View style={styles.gutter}>
        <View style={[styles.icon, { borderColor: ink, backgroundColor: toneWash(tone, color) }]}>
          <SymbolView name={(icon ?? TONE_ICON[tone]) as never} size={13} tintColor={ink} weight="semibold" />
        </View>
        {last ? null : <View style={[styles.line, { backgroundColor: color.hairline }]} />}
      </View>
      <View style={styles.nodeBody}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rail: { position: "absolute", left: 16, right: 16, height: 2, borderRadius: 1, overflow: "hidden" },
  railFill: { height: 2 },
  badge: { width: 32, height: 32, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: FONT.dataStrong, fontSize: 13 },
  stepCaption: { gap: 2 },
  day: { paddingLeft: 40, paddingTop: 8, paddingBottom: 6 },
  node: { flexDirection: "row", gap: 12 },
  gutter: { width: 28, alignItems: "center" },
  icon: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  line: { width: 1, flex: 1, marginVertical: 2 },
  nodeBody: { flex: 1, paddingBottom: 14 },
});
