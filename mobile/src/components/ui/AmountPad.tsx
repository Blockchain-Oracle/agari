import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, RADIUS, useTheme } from "~/theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;
const MAX_DP = 2;
const MAX_WHOLE = 7;

/**
 * The next amount string after one key (21st "Number Pad" rules for a currency field). A string, never a float:
 * the ticket converts it to base units with core's integer parser (the money rule).
 */
export function nextAmount(current: string, key: (typeof KEYS)[number]): string {
  if (key === "del") return current.slice(0, -1);
  if (key === ".") return current.includes(".") ? current : `${current || "0"}.`;
  const [whole = "", frac] = current.split(".");
  if (frac !== undefined) return frac.length >= MAX_DP ? current : current + key;
  if (whole === "0") return key;
  return whole.length >= MAX_WHOLE ? current : current + key;
}

/** A 3 × 4 amount keypad (21st "Number Pad", bankkroll): digits, a decimal point and delete, a haptic per key. */
export function AmountPad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          accessibilityRole="keyboardkey"
          accessibilityLabel={key === "del" ? "Delete" : key === "." ? "Decimal point" : key}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(nextAmount(value, key));
          }}
          style={({ pressed }) => [styles.key, { backgroundColor: pressed ? color.surface2 : "transparent" }]}
        >
          {key === "del" ? (
            <SymbolView name={{ ios: "delete.left", android: "backspace" }} size={22} tintColor={color.ink} />
          ) : (
            <Text style={[styles.digit, { color: color.ink }]}>{key}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  key: { width: "33.333%", height: 54, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.lg },
  digit: { fontFamily: FONT.dataStrong, fontSize: 26 },
});
