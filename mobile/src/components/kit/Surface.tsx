import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { haptic } from "./haptics";

/** web's plate: surface-1 on a hairline, radius lg. `onPress` makes the whole card one touch target. */
export function Card({ children, onPress, tone = "plain", style, accessibilityLabel }: {
  children: ReactNode;
  onPress?: () => void;
  /** "cream" is the receipt paper island (both themes); "accent" a vermilion-washed callout. */
  tone?: "plain" | "cream" | "accent";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { color } = useTheme();
  const bg = tone === "cream" ? color.cream : tone === "accent" ? color.accentWash : color.surface1;
  const border = tone === "cream" ? color.creamHairline : tone === "accent" ? color.accentDim : color.hairline;
  const base = [styles.card, { backgroundColor: bg, borderColor: border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { opacity: 0.86, transform: [{ scale: 0.992 }] }]}
    >
      {children}
    </Pressable>
  );
}

export type PillTone = "neutral" | "accent" | "profit" | "loss" | "warning";

/** A small status label (web's badge): mono caps on a wash of its tone. */
export function Pill({ label, tone = "neutral", dot }: { label: string; tone?: PillTone; dot?: boolean }) {
  const { color } = useTheme();
  const ink = { neutral: color.inkSecondary, accent: color.accent, profit: color.profit, loss: color.loss, warning: color.warning }[tone];
  const bg = { neutral: color.surface2, accent: color.accentWash, profit: color.profitWash, loss: color.lossWash, warning: color.surface2 }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: ink }]} /> : null}
      <Text style={[styles.pillText, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** web's SectionHeader: "01 · Title" over a hairline, an optional aside and one line of description. */
export function SectionHeader({ index, title, desc, aside }: { index?: string; title: string; desc?: string; aside?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.section, { borderBottomColor: color.hairline }]}>
      <View style={styles.sectionRow}>
        <View style={styles.sectionTitle}>
          {index ? <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{index} ·</Text> : null}
          <Text style={[TYPE.title, { color: color.ink }]} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {typeof aside === "string" ? <Text style={[TYPE.data, { color: color.inkMuted }]}>{aside}</Text> : aside}
      </View>
      {desc ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{desc}</Text> : null}
    </View>
  );
}

/** A page's opening: the accent kicker, the Sora headline, one lead paragraph. */
export function Hero({ kicker, title, lead, children }: { kicker?: string; title: string; lead?: string; children?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.hero}>
      {kicker ? <Text style={[styles.kicker, { color: color.accent }]}>{kicker.toUpperCase()}</Text> : null}
      <Text style={[TYPE.headline, styles.heroTitle, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {lead ? <Text style={[TYPE.body, { color: color.inkSecondary }]}>{lead}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, height: 22, borderRadius: RADIUS.full },
  pillText: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  section: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8, gap: 4, marginTop: 8 },
  sectionRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionTitle: { flexDirection: "row", alignItems: "baseline", gap: 6, flexShrink: 1 },
  hero: { gap: 8 },
  kicker: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  heroTitle: { fontSize: 30, lineHeight: 34 },
});
