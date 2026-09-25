import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { Easing, FadeIn, useReducedMotion, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { FONT } from "~/theme";
import { PITCH_PAPER as PP } from "~/theme/web/explore/pitch";

/**
 * web pitch/primitives.tsx: the folio's typographic furniture, at the values pitch.css computes on a 402 px phone.
 * The deck is paper in both themes, so every colour is the folio's own (PITCH_PAPER).
 */
export type Tone = "ink" | "live" | "verm";
type MonoTone = Tone | "mute" | "faint";

const toneInk = (tone: MonoTone | undefined): string =>
  tone === "live" ? PP.green : tone === "verm" ? PP.verm : tone === "mute" ? PP.mute : tone === "faint" ? PP.faint : PP.ink;

/** pitch.css `pitch-rise`: 22 px up and in over 0.55 s, 40 ms + 80 ms per place in the stagger. */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
function riseIn(i: number) {
  return () => {
    "worklet";
    const delay = 40 + i * 80;
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 22 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: 550, easing: EASE })),
        transform: [{ translateY: withDelay(delay, withTiming(0, { duration: 550, easing: EASE })) }],
      },
    };
  };
}

export function Rise({ i = 0, style, children }: { i?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? FadeIn.duration(0) : riseIn(i)} style={style}>
      {children}
    </Animated.View>
  );
}

/** web `Mono`: JetBrains Mono uppercase, 0.16em tracking; `size` sets the em. */
export function Mono({ children, tone, size = 10.5, style, accessibilityLiveRegion }: { children: ReactNode; tone?: MonoTone; size?: number; style?: StyleProp<TextStyle>; accessibilityLiveRegion?: "polite" }) {
  return <Text accessibilityLiveRegion={accessibilityLiveRegion} style={[styles.mono, { color: toneInk(tone), fontSize: size, lineHeight: size * 1.6, letterSpacing: size * 0.16 }, style]}>{children}</Text>;
}

/** web `Kicker`: a 7 px ink square and the 12 px mono line, 16 px above the headline. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <Rise style={styles.kicker}>
      <View style={styles.kickerSquare} />
      <Text style={styles.kickerText}>{children}</Text>
    </Rise>
  );
}

/** pitch.css h1 sizes at 402 px: clamp() floors (2rem cover/proof, 2.4rem art/close, 1.9rem dense). */
export const H1_SIZE = { cover: 30, art: 36, dense: 28.5, proof: 30, close: 36 } as const;

/**
 * A headline with web's `Emph` stub on its last word: the word under a dotted ink rule with the vermilion eyelet at its
 * end. `lines` break as web's `<br />`s; `inline` runs straight into the emphasised word.
 */
export function H1({ size, lines = [], inline = "", emph, i = 1 }: { size: keyof typeof H1_SIZE; lines?: readonly string[]; inline?: string; emph: string; i?: number }) {
  const fontSize = H1_SIZE[size];
  return (
    <Rise i={i}>
      <Text style={[styles.h1, { fontSize, lineHeight: fontSize * 0.94, letterSpacing: -fontSize * 0.03 }]} accessibilityRole="header">
        {lines.map((line) => `${line}\n`).join("")}
        {inline}
        <Text style={styles.emph}>{emph}</Text>
        <View style={[styles.emphDot, { transform: [{ translateY: fontSize * 0.21 }] }]} />.
      </Text>
    </Rise>
  );
}

/** web `pitch-lead`: 15.5 px mono body at 1.6; `mute` is the proof slide's quieter lead. */
export function Lead({ children, i = 2, mute = false }: { children: ReactNode; i?: number; mute?: boolean }) {
  return (
    <Rise i={i} style={mute ? styles.leadMuteWrap : styles.leadWrap}>
      <Text style={[styles.lead, mute && { color: PP.mute }]}>{children}</Text>
    </Rise>
  );
}

/** The lead's ink span. */
export function Ink({ children }: { children: ReactNode }) {
  return <Text style={{ color: PP.ink }}>{children}</Text>;
}

/** web `Pill`s in a wrapping row, 28 px under the lead. */
export function Pills({ items, i = 3 }: { items: readonly (readonly [string, Tone])[]; i?: number }) {
  return (
    <Rise i={i} style={styles.pills}>
      {items.map(([label, tone]) => (
        <View key={label} style={styles.pill}>
          <View style={[styles.pillDot, { backgroundColor: tone === "ink" ? PP.mute : toneInk(tone) }]} />
          <Text style={[styles.pillText, { color: tone === "ink" ? PP.mute : toneInk(tone) }]}>{label}</Text>
        </View>
      ))}
    </Rise>
  );
}

/** The ledger rule: 2 px ink with the 6 px vermilion eyelet on its right end. */
export function Rule() {
  return (
    <View style={styles.rule}>
      <View style={styles.eyelet} />
    </View>
  );
}

/** web `pitch-leader` / `pitch-stat-dots`: 2.6 px dots every 7 px. */
export function Dots({ ink = false, style }: { ink?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.dots, style]}>
      <Svg width="100%" height={3}>
        <Line x1={1.5} y1={1.5} x2="100%" y2={1.5} stroke={ink ? PP.ink : PP.hair} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="0 7" />
      </Svg>
    </View>
  );
}

/** web `CountUp`: the figure counts up once on arrival (1.4 s, cubic out); under Reduce Motion it lands at once. */
export function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 1400);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, reduce]);
  return <>{value.toLocaleString("en-US")}</>;
}

/** Registration tick at one corner of the frame: two 1 px vermilion lines crossing, centred on the corner. */
export function Tick({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const place = { tl: { top: -5.5, left: -5.5 }, tr: { top: -5.5, right: -5.5 }, bl: { bottom: -5.5, left: -5.5 }, br: { bottom: -5.5, right: -5.5 } }[pos];
  return (
    <View style={[styles.tick, place]} pointerEvents="none">
      <View style={styles.tickV} />
      <View style={styles.tickH} />
    </View>
  );
}

/** web `Tag` on a narrow screen: static, over the mock it labels. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mono: { fontFamily: FONT.dataRegular, textTransform: "uppercase" },
  kicker: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, alignSelf: "flex-start" },
  kickerSquare: { width: 7, height: 7, backgroundColor: PP.ink },
  kickerText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18, letterSpacing: 2.4, textTransform: "uppercase", color: PP.mute },
  h1: { fontFamily: FONT.heading, color: PP.ink },
  emph: { textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: PP.ink },
  emphDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PP.verm, marginLeft: -3 },
  leadWrap: { marginTop: 24 },
  leadMuteWrap: { marginTop: 12 },
  lead: { fontFamily: FONT.dataRegular, fontSize: 15.5, lineHeight: 24.8, color: PP.body },
  pills: { marginTop: 28, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 11, borderWidth: 1, borderColor: PP.hair, backgroundColor: PP.card, borderRadius: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 17, letterSpacing: 0.84, textTransform: "uppercase" },
  rule: { height: 2, backgroundColor: PP.ink, justifyContent: "center" },
  eyelet: { position: "absolute", right: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: PP.verm },
  dots: { height: 3 },
  tick: { position: "absolute", width: 11, height: 11, zIndex: 5 },
  tickV: { position: "absolute", left: 5, top: 0, width: 1, height: 11, backgroundColor: PP.verm },
  tickH: { position: "absolute", top: 5, left: 0, width: 11, height: 1, backgroundColor: PP.verm },
  tag: { alignSelf: "flex-start", marginBottom: 8, borderWidth: 1, borderColor: PP.tagBorder, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, backgroundColor: PP.card },
  tagText: { fontFamily: FONT.dataRegular, fontSize: 9.5, lineHeight: 15, letterSpacing: 1.33, textTransform: "uppercase", color: PP.verm },
});
