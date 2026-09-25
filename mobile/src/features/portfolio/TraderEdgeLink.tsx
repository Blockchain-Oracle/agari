import { Pressable, StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import { usePortfolioTokens } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { go } from "./go";

/**
 * web `TraderEdgeLink` (trader-edge-link.css, the ≤640 px rules): its own dark or cream slab, radius 18, padding 23/21,
 * the vermilion edge bar at 45 % height, the 8 px mono eyebrow, the Sora title, and a full-width vermilion pill.
 */
export function TraderEdgeLink() {
  const t = usePortfolioTokens();
  const words = HISTORY.edgeLink;
  return (
    <Pressable
      onPress={() => go("/portfolio/edge")}
      accessibilityRole="link"
      accessibilityLabel={`${words.title}. ${words.action}`}
      style={({ pressed }) => [styles.link, { backgroundColor: t.teBg, borderColor: t.teRule }, pressed && styles.pressed]}
    >
      <View style={styles.edge} pointerEvents="none">
        <View style={[styles.bar, { backgroundColor: t.vermilion }]} />
      </View>
      <View>
        <Text style={[styles.eyebrow, { color: t.vermilion }]}>{words.eyebrow}</Text>
        <Text style={[styles.title, { color: t.teText }]}>{words.title}</Text>
        <Text style={[styles.copy, { color: t.teMute }]}>{words.copy}</Text>
      </View>
      <View style={[styles.action, { backgroundColor: t.vermilion }]}>
        <Text style={[styles.actionText, { color: t.teActionInk }]}>{words.action}</Text>
        <Text style={[styles.arrow, { color: t.teActionInk }]}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { gap: 20, minHeight: 132, overflow: "hidden", borderWidth: 1, borderRadius: 18, paddingVertical: 23, paddingHorizontal: 21 },
  pressed: { transform: [{ translateY: 1 }, { scale: 0.995 }] },
  edge: { position: "absolute", top: 0, bottom: 0, left: 0, width: 3, justifyContent: "center" },
  bar: { width: 3, height: "45%" },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.44, textTransform: "uppercase" },
  title: { marginTop: 8, fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 21, letterSpacing: -1 },
  copy: { marginTop: 8, fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  action: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
  actionText: { fontFamily: FONT.heading, fontSize: 11, lineHeight: 17.6 },
  arrow: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 20 },
});
