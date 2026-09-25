import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { FONT, useTheme } from "~/theme";

export interface StepItem {
  label: string;
  hint?: string;
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * desk-kit `StepProgress` (web timeline.tsx, 21st #29458) at phone width: numbered badges joined by a rail that fills
 * to the current step; done steps show a check and can be revisited, later ones cannot. Under 640 px only the current
 * step's label and hint show (desk-kit.css).
 */
export function StepProgress({ steps, current, onPick, label }: { steps: readonly StepItem[]; current: number; onPick: (step: number) => void; label: string }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const fraction = steps.length > 1 ? (current - 1) / (steps.length - 1) : 0;
  const fill = useSharedValue(fraction);
  useEffect(() => {
    fill.value = reduce ? fraction : withTiming(fraction, { duration: 450, easing: EASE });
  }, [fraction, reduce, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View accessibilityRole="tablist" accessibilityLabel={label}>
      <View style={[styles.rail, { backgroundColor: color.hairline }]} pointerEvents="none">
        <Animated.View style={[styles.railFill, { backgroundColor: color.accent }, fillStyle]} />
      </View>
      <View style={styles.row}>
        {steps.map((s, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "next";
          const align = i === 0 ? "flex-start" : i === steps.length - 1 ? "flex-end" : "center";
          const textAlign = i === 0 ? "left" : i === steps.length - 1 ? "right" : "center";
          const ink = state === "done" ? color.inkSecondary : state === "current" ? color.ink : color.inkMuted;
          return (
            <View key={s.label} style={[styles.cell, { alignItems: align }]}>
              <Pressable
                disabled={state !== "done"}
                onPress={() => onPick(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n}. ${s.label}`}
                accessibilityState={{ disabled: state !== "done", selected: state === "current" }}
                style={[styles.button, { alignItems: align }]}
              >
                <View style={styles.badgeWrap}>
                  {state === "current" ? <View style={[styles.ring, { backgroundColor: color.accentWash }]} /> : null}
                  <View
                    style={[
                      styles.badge,
                      state === "done"
                        ? { backgroundColor: color.accent, borderColor: color.accent }
                        : { backgroundColor: color.surface1, borderColor: state === "current" ? color.accent : color.hairline },
                    ]}
                  >
                    {state === "done" ? (
                      <Check size={14} strokeWidth={3} color={color.onAccent} />
                    ) : (
                      <Text style={[styles.badgeText, { color: state === "current" ? color.accent : ink }]}>{n}</Text>
                    )}
                  </View>
                </View>
                {state === "current" ? (
                  <View style={styles.text}>
                    <Text style={[styles.label, { color: ink, textAlign }]} numberOfLines={1}>
                      {s.label}
                    </Text>
                    {s.hint ? (
                      <Text style={[styles.hint, { color: color.inkMuted, textAlign }]} numberOfLines={1}>
                        {s.hint}
                      </Text>
                    ) : null}
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

const styles = StyleSheet.create({
  rail: { position: "absolute", top: 15, left: 16, right: 16, height: 2 },
  railFill: { height: 2 },
  row: { flexDirection: "row" },
  cell: { flex: 1 },
  button: { gap: 8 },
  badgeWrap: { width: 32, height: 32 },
  ring: { position: "absolute", top: -4, left: -4, width: 40, height: 40, borderRadius: 20 },
  badge: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 20.8 },
  text: { gap: 2 },
  label: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  hint: { fontFamily: FONT.body, fontSize: 11.5, lineHeight: 18.4 },
});
