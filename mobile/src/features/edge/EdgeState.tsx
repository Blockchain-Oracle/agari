import { EDGE } from "@/features/edge/copy";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { FONT } from "~/theme";
import { useEdgeInk } from "./useEdgeInk";

const RULE_EVERY = 80;
const STAMP = "ACCOUNT / PERFORMANCE / FILLS";

/** `.edge-enter`: an 18 px rise over 0.58 s on web's ease; still under Reduce Motion. */
export function EdgeEnter({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) t.value = withTiming(1, { duration: 580, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  }, [reduce, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ translateY: (1 - t.value) * 18 }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The panel's paper: the left-to-right wash to 72% and a 1 px rule every 80 px (`repeating-linear-gradient`). */
function PanelPaper() {
  const { edge } = useEdgeInk();
  const [width, setWidth] = useState(0);
  const rules = Math.floor(width / RULE_EVERY);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <LinearGradient colors={[edge.paper, edge.paperClear]} locations={[0, 0.72]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      {Array.from({ length: rules }, (_, i) => (
        <View key={i} style={[styles.rule, { left: (i + 1) * RULE_EVERY - 1, backgroundColor: edge.rule }]} />
      ))}
      <View style={styles.stampBox}>
        <Text style={[styles.stamp, { color: edge.faint }]} numberOfLines={1}>
          {STAMP}
        </Text>
      </View>
    </View>
  );
}

/** web `.edge-state-action`: the vermilion 44 pt slab in Sora 12 bold, 4 pt corners. */
export function EdgeStateAction({ label, onPress }: { label: string; onPress: () => void }) {
  const { edge } = useEdgeInk();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, { backgroundColor: pressed ? edge.vermilionD : edge.vermilion }, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.actionText, { color: edge.actionInk }]}>{label}</Text>
    </Pressable>
  );
}

/** web `EdgeState`: the reference's tall lined panel for connect, failed and nothing settled. */
export function EdgeState({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  const { edge } = useEdgeInk();
  return (
    <View style={[styles.panel, { borderColor: edge.rule }]}>
      <PanelPaper />
      <View style={styles.inner}>
        <Text style={[styles.eyebrow, { color: edge.vermilion }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: edge.text }]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[styles.copy, { color: edge.muted }]}>{copy}</Text>
        {action ? <View style={styles.actionSlot}>{action}</View> : null}
      </View>
    </View>
  );
}

/** web `EdgeSkeleton`: the panel holding one 330 pt surface with a travelling shimmer. */
export function EdgeSkeleton() {
  const { edge } = useEdgeInk();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (!reduce) x.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [reduce, x]);
  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: (x.value * 2 - 1) * width }] }));
  return (
    <View style={[styles.panel, { borderColor: edge.rule }]} accessibilityRole="progressbar" accessibilityLabel={EDGE.states.reading} accessibilityState={{ busy: true }}>
      <PanelPaper />
      <View style={[styles.skeleton, { backgroundColor: edge.surface }]} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {reduce ? null : (
          <Animated.View style={[StyleSheet.absoluteFill, shimmer]}>
            <LinearGradient colors={[edge.shimmerClear, edge.shimmer, edge.shimmerClear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { minHeight: 420, marginTop: 22, overflow: "hidden", borderTopWidth: 1, borderBottomWidth: 1, paddingTop: 42, paddingHorizontal: 22, paddingBottom: 96 },
  rule: { position: "absolute", top: 0, bottom: 0, width: 1 },
  // `writing-mode: vertical-rl` at top 22, right 16: the line is laid out horizontally, then turned a quarter.
  stampBox: { position: "absolute", top: 22, right: 16, width: 12, height: 190 },
  stamp: { position: "absolute", top: 89.4, left: -89, width: 190, textAlign: "left", fontFamily: FONT.dataRegular, fontSize: 7, lineHeight: 11.2, letterSpacing: 1.12, transform: [{ rotate: "90deg" }] },
  inner: { maxWidth: 590, paddingRight: 8 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.8, textTransform: "uppercase" },
  title: { marginTop: 14, fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 30.6, letterSpacing: -1.5 },
  copy: { marginTop: 15, fontFamily: FONT.body, fontSize: 12, lineHeight: 20.4 },
  actionSlot: { marginTop: 22, alignItems: "flex-start" },
  action: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 4, paddingVertical: 10, paddingHorizontal: 20 },
  actionText: { fontFamily: FONT.heading, fontSize: 12 },
  pressed: { transform: [{ translateY: 1 }, { scale: 0.985 }] },
  skeleton: { width: "100%", minHeight: 330, borderRadius: 18, overflow: "hidden" },
});
