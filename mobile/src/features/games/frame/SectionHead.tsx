import { StyleSheet, Text, View } from "react-native";
import { FONT } from "~/theme";
import { useGamesTokens } from "./tokens";

/**
 * web's `SectionHead` (yosuku part-05 `.section-head`, phone rules in part-15): the mono index bottom-left, the
 * Sora 22 title and its 12 px description, the 1 px rule with a 46 px vermilion tick at its left end.
 */
export function SectionHead({ number, title, desc }: { number: string; title: string; desc?: string }) {
  const { t, color } = useGamesTokens();
  return (
    <View style={[styles.head, { borderBottomColor: t.sectionRule }]} accessibilityRole="header">
      <View style={styles.index}>
        <Text style={[styles.num, { color: color.inkMuted }]}>{number}</Text>
      </View>
      <View style={styles.mid}>
        <Text style={[styles.title, { color: color.ink }]}>{title}</Text>
        {desc ? <Text style={[styles.desc, { color: color.inkMuted }]}>{desc}</Text> : null}
      </View>
      <View style={[styles.tick, { backgroundColor: color.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-end", columnGap: 14, paddingBottom: 18, marginBottom: 24, borderBottomWidth: 1 },
  index: { alignItems: "center", paddingBottom: 2, marginRight: 8 },
  num: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.4 },
  mid: { flex: 1, gap: 6 },
  title: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 24, letterSpacing: -0.55 },
  desc: { marginTop: 2, fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  tick: { position: "absolute", left: 0, bottom: -1, width: 46, height: 2 },
});
