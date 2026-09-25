import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FONT, useTheme } from "~/theme";
import { hiwTokens } from "~/theme/web/explore/how-it-works";

/**
 * The faces how-it-works.css asks for beyond the app's set: Inter 700 and 900 (the title, labels, numbers) and
 * JetBrains Mono 700 / 800 (the chips, the figures; web's 900 draws the heaviest cut the face has). Loaded by the
 * screen through `useFonts`.
 */
export const HIW_FONT = {
  bold: "Inter_700Bold",
  black: "Inter_900Black",
  monoBold: "JetBrainsMono_700Bold",
  monoHeavy: "JetBrainsMono_800ExtraBold",
} as const;

export type HiwTone = "plain" | "mint" | "blue";

/** web `.hiw-rise`: opacity 0, y 20 → in over 0.5 s, delayed `base + index × 80` ms (rise.ts). */
export function Rise({ index = 0, baseMs = 0, style, children }: { index?: number; baseMs?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(baseMs + index * 80).duration(500)} style={style}>
      {children}
    </Animated.View>
  );
}

/** web `.hiw-section`: 80 below. */
export function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

/** web `.hiw-label` (+ `.hiw-label-blue`): Inter 700 12 uppercase gray-500, its optional 16 px glyph. */
export function Label({ title, icon: Icon, blue = false, style }: { title: string; icon?: LucideIcon; blue?: boolean; style?: StyleProp<ViewStyle> }) {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  return (
    <View style={[styles.label, style]}>
      {Icon ? <Icon size={16} color={blue ? t.blue : color.inkMuted} /> : null}
      <Text style={[styles.labelText, { color: color.inkMuted }]} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/** web `.hiw-card` (radius 16, padding 24) with its mint and blue edges. */
export function Card({ tone = "plain", style, children }: { tone?: HiwTone; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const { name } = useTheme();
  const t = hiwTokens(name);
  const edge = tone === "mint" ? t.mintEdge : tone === "blue" ? t.blueEdge : t.line;
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: edge }, style]}>{children}</View>;
}

/** web `.hiw-card-head`: the 32 px tile with its 16 px glyph (gray, or blue on the architecture cards) and the title. */
export function CardHead({ icon: Icon, title, blue = false, fee = false }: { icon: LucideIcon; title: string; blue?: boolean; fee?: boolean }) {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  return (
    <View style={styles.head}>
      <View style={[styles.tile, { backgroundColor: blue ? t.blueWash : t.tile }]}>
        <Icon size={16} color={blue ? t.blue : color.inkSecondary} />
      </View>
      <Text style={[fee ? styles.feeTitle : styles.cardTitle, styles.flush, { color: color.ink }]}>{title}</Text>
    </View>
  );
}

/** web `.hiw-body` (`dim` is `.hiw-body-dim`). */
export function Body({ children, dim = false, style }: { children: ReactNode; dim?: boolean; style?: StyleProp<TextStyle> }) {
  const { color } = useTheme();
  return <Text style={[styles.body, { color: dim ? color.inkMuted : color.inkSecondary }, style]}>{children}</Text>;
}

/** web `.hiw-fee-title`: Inter 700 14, 8 below. */
export function FeeTitle({ children }: { children: string }) {
  const { color } = useTheme();
  return <Text style={[styles.feeTitle, { color: color.ink }]}>{children}</Text>;
}

/** web `.hiw-card-title` with its leading 16 px glyph in the step's tone (Getting Started). */
export function StepTitle({ icon: Icon, tone, children }: { icon: LucideIcon; tone: "mint" | "blue"; children: string }) {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  return (
    <View style={styles.titleRow}>
      <Icon size={16} color={tone === "mint" ? t.mint : t.blue} />
      <Text style={[styles.cardTitle, styles.flush, { color: color.ink }]}>{children}</Text>
    </View>
  );
}

/** web `.hiw-example-tag`: the mint mono pill. */
export function Tag({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  const { name } = useTheme();
  const t = hiwTokens(name);
  return (
    <View style={[styles.tag, { borderColor: t.mintTagEdge }, style]}>
      <Text style={[styles.tagText, { color: t.mint }]}>{children}</Text>
    </View>
  );
}

/** web `.hiw-params`: `dt` in mono ink, `dd` ": …" in gray-400, one per row. */
export function Params({ rows }: { rows: readonly (readonly [string, string])[] }) {
  const { color } = useTheme();
  return (
    <View style={styles.params}>
      {rows.map(([word, meaning]) => (
        <Text key={word} style={[styles.param, { color: color.inkSecondary }]}>
          <Text style={[styles.paramKey, { color: color.ink }]}>{word}</Text>: {meaning}
        </Text>
      ))}
    </View>
  );
}

/** web `.hiw-steps`: the vermilion 32 px number tile beside a label and body (or any content). */
export function Steps({ items }: { items: readonly { key: string; num: string; body: ReactNode }[] }) {
  const { name, color } = useTheme();
  const t = hiwTokens(name);
  return (
    <View style={styles.steps}>
      {items.map((item) => (
        <View key={item.key} style={styles.stepRow}>
          <View style={[styles.stepNum, { backgroundColor: t.vermilionWash }]}>
            <Text style={[styles.stepNumText, { color: color.accent }]}>{item.num}</Text>
          </View>
          <View style={styles.flex}>{item.body}</View>
        </View>
      ))}
    </View>
  );
}

/** web `.hiw-step-label`. */
export function StepLabel({ children }: { children: string }) {
  const { color } = useTheme();
  return <Text style={[styles.feeTitle, styles.flush, { color: color.ink }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: { marginBottom: 80 },
  label: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 32 },
  labelText: { fontFamily: HIW_FONT.bold, fontSize: 12, lineHeight: 19.2, letterSpacing: 1.2, textTransform: "uppercase" },
  card: { borderWidth: 1, borderRadius: 16, padding: 24 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  tile: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  cardTitle: { fontFamily: HIW_FONT.bold, fontSize: 16, lineHeight: 25.6 },
  feeTitle: { fontFamily: HIW_FONT.bold, fontSize: 14, lineHeight: 22.4, marginBottom: 8 },
  flush: { marginBottom: 0, flexShrink: 1 },
  body: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.75 },
  tag: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 9999, paddingVertical: 3, paddingHorizontal: 10, marginBottom: 20 },
  tagText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  params: { gap: 16 },
  param: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  paramKey: { fontFamily: FONT.dataRegular },
  steps: { gap: 16 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  stepNum: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontFamily: HIW_FONT.bold, fontSize: 12, lineHeight: 19.2 },
  flex: { flex: 1, minWidth: 0 },
});
