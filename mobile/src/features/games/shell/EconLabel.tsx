import type { EconomicKind } from "@agari/core/games";
import { StyleSheet, Text, View } from "react-native";
import { FONT, RADIUS, useTheme } from "~/theme";

/**
 * web's `.gm-econ` chip: the mode's honest line about whose money is at risk. Money at risk reads in the
 * brand accent; a mode that risks nothing stays quiet.
 */
export function EconLabel({ kind, label }: { kind: EconomicKind; label: string }) {
  const { color } = useTheme();
  const atRisk = kind !== "none";
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: atRisk ? color.accentDim : color.hairline,
          backgroundColor: atRisk ? color.accentWash : "transparent",
        },
      ]}
      accessibilityLabel={`Economics: ${label}`}
    >
      <Text style={[styles.text, { color: atRisk ? color.accent : color.inkSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 0.4 },
});
