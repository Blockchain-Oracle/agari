import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TabScreen } from "~/components/shell/TabScreen";
import { SITE_URL } from "~/lib/env";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const MODES = [
  { title: "Duel", line: "Face another player over a live market deck.", path: "/games/duel", icon: "⚔" },
  { title: "Lucky", line: "Let a reel deal your next live market call.", path: "/games/lucky", icon: "✦" },
  { title: "Range", line: "Choose the band where price should finish.", path: "/games/range", icon: "▤" },
  { title: "Moonshot", line: "Aim for a distant price target.", path: "/games/moonshot", icon: "↗" },
  { title: "Line Rider", line: "Ride the live price line and build a combo.", path: "/games/line-rider", icon: "〽" },
  { title: "Candle Hop", line: "Hop through a candlestick run.", path: "/games/candle-hop", icon: "▥" },
] as const;

export default function GamesScreen() {
  const { color } = useTheme();
  return <TabScreen><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
    <Text style={[styles.kicker, { color: color.accent }]}>THE MARKET, IN PLAY</Text>
    <Text style={[styles.title, { color: color.ink }]}>{"Learn the move.\nThen call it."}</Text>
    <Text style={[TYPE.body, { color: color.inkSecondary }]}>Practice on live public prices without a wallet or stakes. Other game modes open their current web version inside Agari.</Text>
    <Pressable onPress={() => router.push("/games/practice")} accessibilityRole="link" style={({ pressed }) => [styles.feature, { backgroundColor: color.cream, borderColor: color.creamHairline, opacity: pressed ? 0.82 : 1 }]}>
      <Text style={[styles.kicker, { color: color.accent }]}>01 · START HERE</Text>
      <Text style={[styles.featureTitle, { color: color.creamInk }]}>Practice</Text>
      <Text style={[TYPE.body, { color: color.creamInk }]}>Choose Up or Down on real feed readings. Watch the price for 30 seconds and see how your calls scored.</Text>
      <View style={[styles.featureButton, { backgroundColor: color.accent }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>Play practice</Text><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>→</Text></View>
    </Pressable>
    <View style={[styles.sectionHead, { borderTopColor: color.hairline }]}><Text style={[styles.kicker, { color: color.accent }]}>02</Text><Text style={[TYPE.title, { color: color.ink }]}>More ways to play</Text></View>
    {MODES.map((mode) => <Pressable key={mode.path} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}${mode.path}`)} accessibilityRole="link" style={({ pressed }) => [styles.mode, { backgroundColor: color.surface1, borderColor: color.hairline, opacity: pressed ? 0.8 : 1 }]}><View style={[styles.icon, { backgroundColor: color.accentWash }]}><Text style={[styles.iconText, { color: color.accent }]}>{mode.icon}</Text></View><View style={styles.modeText}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{mode.title}</Text><Text style={[TYPE.caption, { color: color.inkSecondary }]}>{mode.line}</Text></View><Text style={[TYPE.caption, { color: color.accent }]}>↗</Text></Pressable>)}
    <Text style={[TYPE.caption, { color: color.inkMuted }]}>More modes open the web version. Practice is native and uses the same game rules as web.</Text>
  </ScrollView></TabScreen>;
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 28, paddingBottom: 130, gap: 14 }, kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 2 },
  title: { fontFamily: "Georgia", fontWeight: "700", fontSize: 42, lineHeight: 46, letterSpacing: -2, marginVertical: 10 },
  feature: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, gap: 13, marginTop: 17 }, featureTitle: { fontFamily: "Georgia", fontWeight: "700", fontSize: 38, letterSpacing: -2 },
  featureButton: { height: 48, borderRadius: RADIUS.md, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingTop: 20, marginTop: 13 },
  mode: { minHeight: 82, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }, icon: { width: 43, height: 43, borderRadius: 22, alignItems: "center", justifyContent: "center" }, iconText: { fontSize: 25 }, modeText: { flex: 1, gap: 3 },
});
