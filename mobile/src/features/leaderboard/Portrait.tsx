import { StyleSheet, Text, View } from "react-native";
import { glyphFromAddress } from "@/features/leaderboard/glyph";
import { addressHue } from "@/lib/address-hue";
import { AVATAR_COLORS, FONT, useTheme } from "~/theme";

/**
 * web's `.podium-portrait` / `.bz-portrait`: the address's decorative glyph (`glyphFromAddress`) on a disc whose colour
 * the address picks (web's `addressHue`, mapped onto the app's avatar palette), so one trader is one colour everywhere.
 */
export function Portrait({ address, size = 36, ring }: { address: string; size?: number; ring?: string }) {
  const { color } = useTheme();
  const fill = AVATAR_COLORS[addressHue(address) % AVATAR_COLORS.length];
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: fill },
        ring ? { borderWidth: 2, borderColor: ring } : null,
      ]}
      accessible={false}
    >
      <Text style={[styles.glyph, { color: color.creamInk, fontSize: Math.round(size * 0.42) }]}>{glyphFromAddress(address)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: "center", justifyContent: "center" },
  glyph: { fontFamily: FONT.headingHeavy },
});
