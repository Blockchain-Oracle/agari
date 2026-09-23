import { StyleSheet, Text, View } from "react-native";
import { FONT, useTheme } from "~/theme";
import { AgariMark } from "./AgariMark";

/** The Window Cut mark and wordmark in the native header. */
export function BrandTitle() {
  const { color } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Agari">
      <AgariMark />
      <Text style={[styles.word, { color: color.ink }]}>AGARI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { fontFamily: FONT.headingHeavy, fontSize: 14, letterSpacing: 1.68 },
});
