import { StyleSheet, Text, View } from "react-native";
import { RADIUS, TYPE, useTheme } from "~/theme";

export interface Stat {
  label: string;
  value: string;
  sub?: string;
}

// 21st: arihantcodes/insight-cards — a two-up grid of label, mono figure and a quiet note.
/** web's AgentsScreen Stat tiles (.agents-stat), two to a row on a phone. */
export function StatTiles({ stats }: { stats: readonly Stat[] }) {
  const { color } = useTheme();
  return (
    <View style={styles.grid}>
      {stats.map((s) => (
        <View key={s.label} style={[styles.tile, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessible accessibilityLabel={`${s.label}: ${s.value}${s.sub ? `, ${s.sub}` : ""}`}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]} numberOfLines={1}>
            {s.label}
          </Text>
          <Text style={[TYPE.dataLg, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Text>
          {s.sub ? (
            <Text style={[TYPE.caption, styles.sub, { color: color.inkDisabled }]} numberOfLines={1}>
              {s.sub}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexGrow: 1, flexBasis: "45%", borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  sub: { fontSize: 11.5 },
});
