import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TRADE_FROM_X } from "@/features/x/copy";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";

/**
 * web's TradeFromXScreen `.xt-strip`: the island's own sticky top bar (the app chrome is hidden on this route) —
 * AGARI / X-trade on the left, "open the app →" on the right; the primary nav is `hidden md:flex`, so a phone shows
 * none. It starts under the status bar, which takes the strip's ground.
 */
export function IslandStrip() {
  const t = tradeXTokens(useTheme().name);
  const insets = useSafeAreaInsets();
  const home = () => router.navigate("/markets");
  return (
    <View style={[styles.strip, { paddingTop: insets.top, borderBottomColor: t.stripBorder }]}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.stripBg }]} />
      <View style={styles.inner}>
        <Pressable onPress={home} accessibilityRole="link" hitSlop={8}>
          {({ pressed }) => (
            <Text style={[styles.brand, { color: pressed ? t.v : t.ink }]}>
              AGARI <Text style={[styles.crumb, { color: t.gray500 }]}>{TRADE_FROM_X.crumb}</Text>
            </Text>
          )}
        </Pressable>
        <Pressable onPress={home} accessibilityRole="link" hitSlop={8}>
          {({ pressed }) => (
            <View style={[styles.open, pressed && styles.openPressed]}>
              <Text style={[styles.openText, { color: t.v }]}>{TRADE_FROM_X.openApp}</Text>
              <ArrowRight size={14} color={t.v} strokeWidth={2} />
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { borderBottomWidth: 1, overflow: "hidden" },
  inner: { height: 56, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  brand: { fontFamily: FONT.headingHeavy, fontSize: 14, lineHeight: 22.4, letterSpacing: 2.24 },
  crumb: { fontFamily: FONT.dataRegular, letterSpacing: 0 },
  open: { flexDirection: "row", alignItems: "center", gap: 6 },
  openPressed: { gap: 10 },
  openText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
});
