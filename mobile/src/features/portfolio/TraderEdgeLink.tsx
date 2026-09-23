import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import { Card } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";
import { go } from "./go";

/** web `TraderEdgeLink`: the eyebrow, the claim and its one line, and the way into the Trader Edge report. */
export function TraderEdgeLink() {
  const { color } = useTheme();
  const words = HISTORY.edgeLink;
  return (
    <Card onPress={() => go("/portfolio/edge")} accessibilityLabel={`${words.title} ${words.action}`}>
      <Text style={[styles.eyebrow, { color: color.accent }]}>{words.eyebrow}</Text>
      <Text style={[TYPE.title, { color: color.ink }]}>{words.title}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.copy}</Text>
      <View style={styles.action}>
        <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{words.action}</Text>
        <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={15} tintColor={color.accent} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase" },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
});
