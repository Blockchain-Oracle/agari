import { Check, type LucideIcon } from "lucide-react-native";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { lucideOf, type LegacyIcon } from "./primitives";
import { useDeskTheme } from "./theme";
import { TONE_LUCIDE, type NodeTone } from "./tone";

/**
 * The desk kit's sequences, from web/src/components/ui/desk-kit/timeline.tsx: Onboarding Steps with Progress (21st
 * #29458) for the studio, and Interactive Timeline (#28276) with Agent Activity (#29318) for the record.
 */
export interface StepItem {
  label: string;
  hint?: string;
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * `.dkit-steps`: round numbered badges on a rail; done steps show a check and can be revisited, later ones cannot. At
 * phone width only the current step's label and hint show (desk-kit.css ≤ 640 px), under its badge.
 */
export function StepProgress({ steps, current, onPick, label }: { steps: readonly StepItem[]; current: number; onPick: (step: number) => void; label: string }) {
  const { color } = useDeskTheme();
  const reduce = useReducedMotion();
  const fraction = steps.length > 1 ? (current - 1) / (steps.length - 1) : 0;
  const fill = useSharedValue(fraction);
  useEffect(() => {
    fill.value = reduce ? fraction : withTiming(fraction, { duration: 450, easing: EASE });
  }, [fraction, reduce, fill]);
  const railFill = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const last = steps.length - 1;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 1, max: steps.length, now: current }}>
      <View style={[styles.rail, { backgroundColor: color.hairline }]}>
        <Animated.View style={[styles.railFill, { backgroundColor: color.accent }, railFill]} />
      </View>
      <View style={styles.stepRow}>
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "next";
          const align = i === 0 ? "flex-start" : i === last ? "flex-end" : "center";
          return (
            <View key={s.label} style={[styles.stepCell, { alignItems: align }]}>
              <Pressable
                disabled={state !== "done"}
                onPress={() => {
                  haptic.select();
                  onPick(n);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${n} ${s.label}${state === "done" ? ", done" : state === "current" ? ", current step" : ""}`}
                accessibilityState={{ disabled: state !== "done", selected: state === "current" }}
                hitSlop={8}
                style={[styles.stepButton, { alignItems: align }]}
              >
                <View
                  style={[
                    styles.badge,
                    state === "done" && { borderColor: color.accent, backgroundColor: color.accent },
                    state === "current" && { borderColor: color.accent, backgroundColor: color.surface1, boxShadow: `0 0 0 4px ${color.accentWash}` },
                    state === "next" && { borderColor: color.hairline, backgroundColor: color.surface1 },
                  ]}
                >
                  {state === "done" ? <Check size={14} strokeWidth={3} color={color.onAccent} /> : <Text style={[styles.badgeText, { color: state === "current" ? color.accent : color.inkMuted }]}>{n}</Text>}
                </View>
                {state === "current" ? (
                  <View style={[styles.stepText, { alignItems: align }]}>
                    <Text style={[styles.stepLabel, { color: color.ink, textAlign: i === 0 ? "left" : i === last ? "right" : "center" }]}>{s.label}</Text>
                    {s.hint ? <Text style={[styles.stepHint, { color: color.inkMuted, textAlign: i === 0 ? "left" : i === last ? "right" : "center" }]}>{s.hint}</Text> : null}
                  </View>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Whether a node sits inside a `Timeline` (which draws the one continuous rail) or stands alone (draws its own). */
const OnRail = createContext(false);

/** `.dkit-timeline`: a vertical rail of nodes and day labels; the rail runs 8 px in from both ends at x = 15. */
export function Timeline({ children, label }: { children: ReactNode; label: string }) {
  const { color } = useDeskTheme();
  return (
    <View accessibilityLabel={label}>
      <View pointerEvents="none" style={[styles.timelineRail, { backgroundColor: color.hairline }]} />
      <OnRail.Provider value>{children}</OnRail.Provider>
    </View>
  );
}

/** `.dkit-timeline-day`: "Today", "Yesterday", "Mon 21 Sep" over the nodes that follow. */
export function TimelineDay({ children }: { children: string }) {
  const { color } = useDeskTheme();
  return (
    <Text style={[styles.day, { color: color.inkMuted }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

/** `.dkit-timeline-node`: the verdict's icon in a 32 px ring on the rail, the entry beside it; rises in, one after another. */
export function TimelineNode({ tone, index = 0, last = false, icon, children }: { tone: NodeTone; index?: number; last?: boolean; icon?: LucideIcon | LegacyIcon; children: ReactNode }) {
  const { color } = useDeskTheme();
  const reduce = useReducedMotion();
  const onRail = useContext(OnRail);
  const Icon = icon ? lucideOf(icon) : TONE_LUCIDE[tone];
  const [ink, border, bg] =
    tone === "acted" ? [color.profit, color.profit, color.profitWash]
    : tone === "declined" ? [color.accent, color.accentDim, color.accentWash]
    : tone === "asked" ? [color.warning, color.warning, color.surface1]
    : tone === "error" || tone === "stopped" ? [color.loss, color.loss, color.lossWash]
    : [color.inkMuted, color.hairline, color.surface1];
  const entering = reduce ? undefined : FadeInDown.duration(300).delay(Math.min(index, 10) * 35).easing(EASE);
  return (
    <Animated.View entering={entering} style={styles.node}>
      {!onRail && !last ? <View pointerEvents="none" style={[styles.ownRail, { backgroundColor: color.hairline }]} /> : null}
      <View style={[styles.icon, { borderColor: border, backgroundColor: color.surface1 }]}>
        <View style={[StyleSheet.absoluteFill, styles.iconFill, { backgroundColor: bg }]} />
        <Icon size={15} color={ink} strokeWidth={tone === "acted" ? 2.75 : 2} />
      </View>
      <View style={styles.nodeBody}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rail: { position: "absolute", top: 15, left: 16, right: 16, height: 2 },
  railFill: { height: 2 },
  stepRow: { flexDirection: "row" },
  stepCell: { flex: 1 },
  stepButton: { gap: 8 },
  badge: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: FONT.bodyStrong, fontSize: 13 },
  stepText: { gap: 2 },
  stepLabel: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  stepHint: { fontFamily: FONT.body, fontSize: 11.5, lineHeight: 18.4 },
  timelineRail: { position: "absolute", top: 8, bottom: 8, left: 15, width: 1 },
  day: { paddingTop: 14, paddingBottom: 8, paddingLeft: 44, fontFamily: FONT.body, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 1.47, textTransform: "uppercase" },
  node: { flexDirection: "row", gap: 12, paddingVertical: 6 },
  ownRail: { position: "absolute", top: 38, bottom: -6, left: 15, width: 1 },
  icon: { zIndex: 1, width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  iconFill: { borderRadius: 16 },
  nodeBody: { flex: 1, minWidth: 0 },
});
