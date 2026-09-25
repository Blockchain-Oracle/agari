import type { EconomicKind } from "@agari/core/games";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { FONT } from "~/theme";
import { useGamesTokens } from "./tokens";

/**
 * games.css `.gm-econ`: the mode's honest line about whose money is at risk. Money at risk reads in the brand
 * accent; a mode that risks nothing stays quiet. `block` is the rail's phone rule (a row of its own).
 */
export function Econ({ kind, label, block, style }: { kind: EconomicKind; label: string; block?: boolean; style?: StyleProp<ViewStyle> }) {
  const { t, color } = useGamesTokens();
  const risk = kind !== "none";
  return (
    <View
      style={[styles.econ, block ? styles.block : styles.inline, { borderColor: risk ? t.econRiskBorder : t.econBorder, backgroundColor: risk ? t.econRiskBg : "transparent" }, style]}
      accessibilityLabel={`Economics: ${label}`}
    >
      <Text style={[styles.econText, { color: risk ? color.accent : color.inkSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export type BadgeTone = "live" | "after" | "quiet";

/** games.css `.gm-badge` (`--live` profit, `--after` warning, otherwise gray-500), mono 9, pushed right. */
export function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  const { t, color } = useGamesTokens();
  const [border, ink] = tone === "live" ? [t.badgeLiveBorder, color.profit] : tone === "after" ? [t.badgeAfterBorder, t.warning] : [t.badgeBorder, color.inkMuted];
  return (
    <View style={[styles.badge, { borderColor: border }]}>
      <Text style={[styles.badgeText, { color: ink }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  econ: { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 9999, borderWidth: 1 },
  inline: { alignSelf: "flex-start" },
  block: { alignSelf: "stretch" },
  econText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.4 },
  badge: { marginLeft: "auto", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 9999, borderWidth: 1 },
  badgeText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.72 },
});
