import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { FONT } from "~/theme";
import { useDeskTheme } from "../kit";

/**
 * The decision page's shared pieces, from web's decision.css at ≤ 640 px: a stepper section (a 32 px icon tile on the
 * rail beside its card), the facts list (label over value on a phone), the small caps subhead and the `.dc-badge`.
 */
export function Section({ n, title, icon: Icon, children }: { n: number; title: string; icon: LucideIcon; children: ReactNode }) {
  const { color } = useDeskTheme();
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.duration(350).delay(Math.min(n, 9) * 40).easing(Easing.bezier(0.22, 1, 0.36, 1)).withInitialValues({ transform: [{ translateY: 10 }] })} style={styles.step}>
      <View style={[styles.icon, { backgroundColor: color.surface2, borderColor: color.hairline }]}>
        <Icon size={15} color={color.inkSecondary} />
      </View>
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={title}>
        <View style={styles.titleRow}>
          <Text style={[styles.n, { color: color.accent }]}>{String(n).padStart(2, "0")}</Text>
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

/** `.dc-steps`: the sections on one rail, 1 px at x = 15 from the first icon to the last. */
export function Steps({ children, label }: { children: ReactNode; label: string }) {
  const { color } = useDeskTheme();
  return (
    <View style={styles.steps} accessibilityLabel={label}>
      <View pointerEvents="none" style={[styles.rail, { backgroundColor: color.hairline }]} />
      {children}
    </View>
  );
}

/** `.dc-facts` at phone width: each label above its value, hairlines between. */
export function Facts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  const { color } = useDeskTheme();
  return (
    <View>
      {rows.map(([label, value], i) => (
        <View key={label} style={[styles.fact, i > 0 && { borderTopWidth: 1, borderTopColor: color.hairline }]}>
          <Text style={[styles.factText, { color: color.inkSecondary }]}>{label}</Text>
          {typeof value === "string" ? <Text style={[styles.factText, { color: color.ink }]}>{value}</Text> : value}
        </View>
      ))}
    </View>
  );
}

/** `.dc-subhead` */
export function Subhead({ children }: { children: string }) {
  const { color } = useDeskTheme();
  return <Text style={[styles.subhead, { color: color.inkMuted }]}>{children}</Text>;
}

/** `.dc-badge`: a hairline caps chip; chosen is solid accent, ok and bad take the profit and loss inks. */
export function DcBadge({ tone, icon: Icon, children }: { tone?: "chosen" | "ok" | "bad"; icon?: LucideIcon; children: string }) {
  const { color, t } = useDeskTheme();
  const [ink, border, bg] =
    tone === "chosen" ? [color.onAccent, color.accent, color.accent] : tone === "ok" ? [color.profit, t.badgeOk, "transparent"] : tone === "bad" ? [color.loss, t.badgeBad, "transparent"] : [color.inkMuted, color.hairline, "transparent"];
  return (
    <View style={[styles.badge, { borderColor: border, backgroundColor: bg }]}>
      {Icon ? <Icon size={12} color={ink} /> : null}
      <Text style={[styles.badgeText, { color: ink }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { gap: 14 },
  rail: { position: "absolute", top: 20, bottom: 20, left: 15, width: 1 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { width: 32, height: 32, marginTop: 8, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  card: { flex: 1, minWidth: 0, gap: 14, padding: 14, borderWidth: 1, borderRadius: 12 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  n: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1 },
  title: { flex: 1, fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6, letterSpacing: -0.16 },
  fact: { gap: 2, paddingVertical: 9 },
  factText: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 21.6, fontVariant: ["tabular-nums"] },
  subhead: { fontFamily: FONT.body, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 1.26, textTransform: "uppercase" },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 3, paddingHorizontal: 9, borderRadius: 9999, borderWidth: 1 },
  badgeText: { fontFamily: FONT.body, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 0.63, textTransform: "uppercase" },
});
