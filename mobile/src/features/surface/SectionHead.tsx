import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { FONT, useTheme } from "~/theme";
import { surfaceTokens } from "~/theme/web/explore/surface";

interface Props {
  number: string;
  title: string;
  desc?: string;
  live?: boolean;
}

/**
 * web's components/shell/SectionHead.tsx (the reference's own SectionHeader) at phone width (yosuku part-05/06, and
 * part-15's ≤720 rules): the mono index, the 22 px Sora title with the Live pill, the grey sentence, the hairline with
 * its 46 px vermilion tick. The right-hand meta is `display: none` on a phone, so it is not drawn.
 */
export function SectionHead({ number, title, desc, live }: Props) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  return (
    <View style={[styles.head, { borderBottomColor: t.sectionRule }]}>
      <View style={styles.index}>
        <Text style={[styles.num, { color: color.inkMuted }]}>{number}</Text>
      </View>
      <View style={styles.mid}>
        <View style={styles.row}>
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {title}
          </Text>
          {live ? <LivePill /> : null}
        </View>
        {desc ? <Text style={[styles.desc, { color: color.inkMuted }]}>{desc}</Text> : null}
      </View>
      <View style={[styles.tick, { backgroundColor: color.accent }]} />
    </View>
  );
}

/** part-06 `.live-pill` with its pulsing dot (pulseDot 1.6 s). */
function LivePill() {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.55, { duration: 1120 }), -1, true);
  }, [reduce, pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={[styles.pill, { borderColor: t.livePillBorder, backgroundColor: t.livePillFill }]}>
      <Animated.View style={[styles.dot, { backgroundColor: color.accent }, dot]} />
      <Text style={[styles.pillText, { color: color.accent }]}>Live</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: 14, rowGap: 10, paddingBottom: 18, marginBottom: 24, borderBottomWidth: 1 },
  index: { alignItems: "center", paddingBottom: 2, marginRight: 8 },
  num: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.4 },
  mid: { flex: 1, minWidth: 0, gap: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 16 },
  title: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 24, letterSpacing: -0.55 },
  desc: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18, marginTop: 2 },
  tick: { position: "absolute", left: 0, bottom: -1, width: 46, height: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 4, paddingBottom: 4, paddingLeft: 9, paddingRight: 11, borderRadius: 999, borderWidth: 1, transform: [{ translateY: -3 }] },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  pillText: { fontFamily: FONT.dataStrong, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
});
