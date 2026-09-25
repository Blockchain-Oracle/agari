import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, useTheme } from "~/theme";
import { AgariMark } from "./AgariMark";
import { AppStrip } from "./AppStrip";
import { CHROME, chromeTokens } from "~/theme/chrome";
import { HeaderAccount } from "./HeaderAccount";
import { Marquee } from "./Marquee";
import { ThemeToggle } from "./ThemeToggle";

/**
 * web's fixed top on a phone, in order: the AppStrip (28), the Marquee (20) and the Header (46) — the Window Cut
 * mark, AGARI and 上がり on the left; the theme ring and the account on the right. The status bar area takes the
 * strip's ground so the chrome reads as one piece.
 */
export function AppChrome() {
  const insets = useSafeAreaInsets();
  const { name } = useTheme();
  const t = chromeTokens(name);
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: t.stripBg }}>
      <AppStrip />
      <Marquee />
      <View style={[styles.header, { backgroundColor: t.headerBg, borderBottomColor: t.headerBorder }]}>
        <Pressable style={styles.logo} onPress={() => router.navigate("/markets")} accessibilityRole="link" accessibilityLabel="Agari 上がり home">
          <AgariMark />
          <Text style={[styles.name, { color: t.logoInk }]}>AGARI</Text>
          <Text style={[styles.jp, { color: t.logoJp }]}>上がり</Text>
        </Pressable>
        <View style={styles.right}>
          <ThemeToggle />
          <HeaderAccount />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: CHROME.header, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderBottomWidth: 1 },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 14, lineHeight: 22.4, letterSpacing: 1.68 },
  jp: { fontFamily: FONT.stamp, fontSize: 14, lineHeight: 22.4, letterSpacing: 0.84 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
});
