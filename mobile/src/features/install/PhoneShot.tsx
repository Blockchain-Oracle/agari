import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { INSTALL } from "@/features/install/copy";
import { SITE_URL } from "~/lib/env";
import { useTheme } from "~/theme";
import { downloadTokens } from "~/theme/web/explore/download";

/** web's capture of `/markets` on a phone (public/demo/bet-screen.png, 780×1688). */
const SHOT = { uri: `${SITE_URL}/demo/bet-screen.png` };
const PHONE_W = 250;
const SCREEN_W = PHONE_W - 12;

/**
 * web's PhoneShot at 402 px: the titanium rim (6 px, radius 42), the screen (radius 36) with the status band, the
 * capture and the island, and the four side controls where part-18.css puts them.
 */
export function PhoneShot() {
  const { name } = useTheme();
  const t = downloadTokens(name);
  return (
    <View style={styles.stage}>
      <View style={[styles.phone, { boxShadow: t.rimShadow }]}>
        <LinearGradient colors={t.rim} locations={[0, 0.18, 0.46, 0.78, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, styles.rim]} />
        {BUTTONS.map((b) => (
          <LinearGradient key={b.key} colors={t.button} locations={[0, 0.4, 1]} style={[styles.button, b.style, { boxShadow: t.buttonShadow }]} />
        ))}
        <View style={[styles.screen, { backgroundColor: t.screen, boxShadow: t.screenShadow }]}>
          <View style={styles.bar} />
          <Image source={SHOT} style={styles.shot} contentFit="cover" accessibilityLabel={INSTALL.shotAlt} />
          <View style={[styles.island, { backgroundColor: t.island }]} />
        </View>
      </View>
    </View>
  );
}

const BUTTONS = [
  { key: "mute", style: { left: -3, top: 86, height: 23 } },
  { key: "volup", style: { left: -3, top: 128, height: 41 } },
  { key: "voldn", style: { left: -3, top: 180, height: 41 } },
  { key: "power", style: { right: -3, top: 147, height: 62 } },
];

const styles = StyleSheet.create({
  stage: { alignItems: "center" },
  phone: { width: PHONE_W, padding: 6, borderRadius: 42 },
  rim: { borderRadius: 42 },
  button: { position: "absolute", width: 3, borderRadius: 3 },
  screen: { borderRadius: 36, overflow: "hidden" },
  bar: { height: 29 },
  shot: { width: SCREEN_W, height: Math.round((SCREEN_W * 1688) / 780) },
  island: { position: "absolute", top: 9, alignSelf: "center", width: 76, height: 22, borderRadius: 999 },
});
