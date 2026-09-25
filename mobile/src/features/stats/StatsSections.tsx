import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FONT, useTheme } from "~/theme";
import { statsTokens } from "~/theme/web/explore/stats";

/** web's `Stat` card (features/stats/StatsSections.tsx, stats.css .stat-card): label, figure, the line under it. */
export function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  const { name, color } = useTheme();
  const t = statsTokens(name);
  return (
    <View
      style={[styles.card, accent ? { borderColor: t.profitBorder, backgroundColor: t.profitFill5 } : { borderColor: t.hairline, backgroundColor: t.card }]}
      accessible
      accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ""}`}
    >
      <Text style={[styles.label, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: accent ? color.profit : color.ink }]}>{value}</Text>
      {sub ? <Text style={[styles.sub, { color: color.inkDisabled }]}>{sub}</Text> : null}
    </View>
  );
}

/** web's `SectionHead`: `01 · Growth · cumulative …` — the vermilion index, the Sora title, the mono tag; `right` wraps under. */
export function SectionHead({ index, title, tag, right }: { index: string; title: string; tag: string; right?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.head, right ? styles.between : null]}>
      <View style={styles.left}>
        <Text style={[styles.index, { color: color.accent }]}>{index}</Text>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[styles.tag, { color: color.inkDisabled }]}>{tag}</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 20 },
  label: { fontFamily: FONT.data, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase", marginTop: 2, marginBottom: 8 },
  value: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 36, letterSpacing: -0.75, fontVariant: ["tabular-nums"] },
  sub: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, marginTop: 4 },
  head: { flexDirection: "row", alignItems: "baseline", gap: 12, marginBottom: 12 },
  between: { justifyContent: "space-between", flexWrap: "wrap", rowGap: 4, columnGap: 12 },
  left: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 12, flexShrink: 1 },
  index: { fontFamily: FONT.dataStrong, fontSize: 11, lineHeight: 17.6 },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 28.8 },
  tag: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, textTransform: "uppercase" },
});
