import { quickChips } from "@agari/core/sizing";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, RADIUS, useTheme } from "~/theme";

/** web's QuickChips: core's fractions of what the account can spend; quiet until the balance is known. */
export function QuickChips({ availableBase, decimals, onPick }: { availableBase: bigint | null; decimals: number; onPick: (stakeBase: bigint) => void }) {
  const { color } = useTheme();
  if (availableBase === null) return null;
  return (
    <View style={styles.row}>
      {quickChips(availableBase, decimals).map((chip) => (
        <Pressable
          key={chip.label}
          disabled={!chip.enabled}
          onPress={() => { Haptics.selectionAsync(); onPick(chip.stakeBase); }}
          style={({ pressed }) => [styles.chip, { borderColor: color.hairline, backgroundColor: pressed ? color.surface2 : color.surface1, opacity: chip.enabled ? 1 : 0.4 }]}
        >
          <Text style={[styles.text, { color: color.ink }]}>{chip.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, height: 36, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: FONT.bodyStrong, fontSize: 13 },
});
