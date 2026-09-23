import type { Side } from "@agari/core/types";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, RADIUS, useTheme } from "~/theme";

/** web's SideSegments: Up and Down, the chosen one in its own ink. */
export function SideToggle({ side, onSelect }: { side: Side | null; onSelect: (side: Side) => void }) {
  const { color } = useTheme();
  const seg = (value: Side, label: string, ink: string, wash: string) => {
    const on = side === value;
    return (
      <Pressable
        key={value}
        onPress={() => { Haptics.selectionAsync(); onSelect(value); }}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        style={[styles.seg, { backgroundColor: on ? wash : "transparent", borderColor: on ? ink : "transparent" }]}
      >
        <Text style={[styles.label, { color: on ? ink : color.inkMuted }]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      {seg("up", "Up", color.profit, color.profitWash)}
      {seg("down", "Down", color.loss, color.lossWash)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", padding: 4, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  seg: { flex: 1, height: 40, borderRadius: RADIUS.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: FONT.headingHeavy, fontSize: 16 },
});
