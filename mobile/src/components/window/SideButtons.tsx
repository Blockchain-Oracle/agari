import type { Side } from "@agari/core/types";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FONT, RADIUS, useTheme } from "~/theme";

/** The Window's two calls at the book's live prices, in cents, as web's HeroYesNo. */
export function SideButtons({ upCents, downCents, onPick, disabled }: { upCents: number | null; downCents: number | null; onPick: (side: Side) => void; disabled?: boolean }) {
  const { color } = useTheme();
  const button = (side: Side, label: string, cents: number | null, ink: string, wash: string) => (
    <Pressable
      key={side}
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPick(side);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${cents === null ? "" : ` at ${cents} cents`}`}
      style={({ pressed }) => [styles.side, { backgroundColor: wash, borderColor: ink, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
      <Text style={[styles.price, { color: ink }]}>{cents === null ? "—" : `${cents}¢`}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {button("up", "Up", upCents, color.profit, color.profitWash)}
      {button("down", "Down", downCents, color.loss, color.lossWash)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  side: { flex: 1, height: 64, borderRadius: RADIUS.lg, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  label: { fontFamily: FONT.headingHeavy, fontSize: 20 },
  price: { fontFamily: FONT.dataStrong, fontSize: 20, fontVariant: ["tabular-nums"] },
});
