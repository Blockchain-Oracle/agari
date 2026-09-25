import { Check, CircleDashed, LoaderCircle, Sparkles } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { FONT, useTheme } from "~/theme";
import { useDeskEntryTokens } from "./kit-bits";

export type ReadStatus = "idle" | "signing" | "waiting" | "done" | "failed";

/** studio.css `.st-spin`: a loader turning once every 0.9 s. */
function Spinner({ color }: { color: string }) {
  const reduce = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!reduce) turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
  }, [reduce, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View style={style}>
      <LoaderCircle size={15} color={color} />
    </Animated.View>
  );
}

/** studio.css `.st-shimmer`: web sweeps a muted-to-ink gradient through the words; here the ink breathes between them. */
function Shimmer({ text }: { text: string }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.linear }), -1, true);
  }, [reduce, t]);
  const style = useAnimatedStyle(() => ({ color: reduce ? color.ink : interpolateColor(t.value, [0, 1], [color.inkMuted, color.ink]) }));
  return <Animated.Text style={[styles.headText, style]}>{text}</Animated.Text>;
}

/**
 * web's TestRead.tsx `ReadStream`: the five things one check does as an agent's activity stream. Signing lights the
 * first; while the desk works the rest spin together; on arrival every one is done.
 */
export function ReadStream({ status }: { status: ReadStatus }) {
  const { color } = useTheme();
  const tk = useDeskEntryTokens();
  const T = STUDIO.read;
  const working = status === "signing" || status === "waiting";
  return (
    <View style={[styles.stream, { backgroundColor: color.surface1, borderColor: status === "done" ? tk.streamDone : color.hairline }]} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Sparkles size={16} color={color.accent} />
        {working ? <Shimmer text={T.working} /> : <Text style={[styles.headText, { color: color.ink }]}>{status === "done" ? T.done : T.streamTitle}</Text>}
      </View>
      <View accessibilityLabel={T.streamTitle}>
        <View style={[styles.line, { backgroundColor: color.hairline }]} />
        {T.steps.map((line, i) => {
          const done = status === "done" || (status === "waiting" && i === 0);
          const active = (status === "signing" && i === 0) || (status === "waiting" && i > 0);
          return (
            <View key={line} style={styles.node}>
              <View style={[styles.icon, done ? { borderColor: color.profit, backgroundColor: color.profitWash } : { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
                {done ? <Check size={15} strokeWidth={2.75} color={color.profit} /> : active ? <Spinner color={color.inkMuted} /> : <CircleDashed size={15} color={color.inkMuted} />}
              </View>
              <Text style={[styles.text, { color: done ? color.ink : active ? color.inkSecondary : color.inkMuted }]}>{line}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stream: { gap: 8, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, borderRadius: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  headText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  line: { position: "absolute", top: 8, bottom: 8, left: 15, width: 1 },
  node: { flexDirection: "row", gap: 12, paddingVertical: 6 },
  icon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, paddingTop: 6, fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20.25 },
});
