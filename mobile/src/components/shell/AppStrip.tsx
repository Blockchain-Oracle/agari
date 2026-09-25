import { router } from "expo-router";
import { ChevronRight, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import Svg, { Path, Rect } from "react-native-svg";
import { storage } from "~/lib/storage";
import { FONT, useTheme } from "~/theme";
import { CHROME, chromeTokens } from "~/theme/chrome";

/** web's key, so the dismissal means the same thing in both. */
const KEY = "agari.appstrip.dismissed";
/** web's second line (its first, "installs as a web app", is not true of the app); "Get it" opens /download as on web. */
const LINE = "Solana devnet — test funds only";

/** web's AppStrip: the thin line above the page, dismissible, the dismissal sticks. */
export function AppStrip() {
  const { name } = useTheme();
  const t = chromeTokens(name);
  const [gone, setGone] = useMMKVBoolean(KEY, storage);
  if (gone) return null;
  return (
    <View style={[styles.strip, { backgroundColor: t.stripBg, borderBottomColor: t.stripBorder }]}>
      <Pressable style={styles.msg} onPress={() => router.push("/download")} accessibilityRole="link" accessibilityLabel={`${LINE}. Get it`}>
        <Svg width={11} height={15} viewBox="0 0 14 20" fill="none" stroke={t.stripText} strokeWidth={1.6} strokeLinecap="round">
          <Rect x={1.2} y={1.2} width={11.6} height={17.6} rx={2.6} />
          <Path d="M5.6 3.6h2.8" />
          <Path d="M7 16.2h0.01" />
        </Svg>
        <Text style={[styles.line, { color: t.stripText }]} numberOfLines={1}>{LINE}</Text>
        <View style={styles.go}>
          <Text style={[styles.goText, { color: t.stripGo }]}>Get it</Text>
          <ChevronRight size={10} color={t.stripGo} strokeWidth={2.6} />
        </View>
      </Pressable>
      <Pressable style={styles.x} onPress={() => setGone(true)} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8}>
        <X size={12} color={t.stripX} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { height: CHROME.strip, flexDirection: "row", alignItems: "center", justifyContent: "center", borderBottomWidth: 1 },
  msg: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 8 },
  line: { fontFamily: FONT.dataRegular, fontSize: 9.5, letterSpacing: 0.38 },
  go: { flexDirection: "row", alignItems: "center", gap: 3 },
  goText: { fontFamily: FONT.heading, fontSize: 10, letterSpacing: 0.1 },
  x: { position: "absolute", right: 2, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
