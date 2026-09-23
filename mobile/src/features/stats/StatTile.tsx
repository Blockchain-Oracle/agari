import { StyleSheet, Text, View } from "react-native";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

// 21st: makviesainte/progress-metric-card — the label over one large figure, the sentence under it.
/** web's `Stat` card (features/stats/StatsSections.tsx): label, figure, the line that says what it counts. */
export function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  const { color } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: accent ? color.accentWash : color.surface1, borderColor: accent ? color.accentDim : color.hairline },
      ]}
      accessible
      accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ""}`}
    >
      <Text style={[styles.label, { color: accent ? color.accent : color.inkMuted }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.value, { color: color.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={[TYPE.caption, { color: color.inkSecondary }]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexBasis: "47%", flexGrow: 1, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  label: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase" },
  value: { fontFamily: FONT.dataStrong, fontSize: 26, lineHeight: 30 },
});
