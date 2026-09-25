import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { addressHue } from "@/lib/address-hue";
import { FONT, useTheme } from "~/theme";

/**
 * A wallet's hue avatar — web's `.act-avatar` / `.prf-avatar` / `.room-avatar`: a radial wash at 30% 20% from the
 * address's hue to a darker step 40° round the wheel. With `initials` it carries the address's first two characters,
 * exactly as written: base58 is case-sensitive (D-010).
 */
export function HueAvatar({ address, size = 32, initials = false }: { address: string; size?: number; initials?: boolean }) {
  const { color } = useTheme();
  const hue = addressHue(address);
  const id = `hue-${hue}`;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <RadialGradient id={id} cx="30%" cy="20%" r="120%" fx="30%" fy="20%">
            <Stop offset="0" {...stopPaint(`hsl(${hue}, 55%, 55%)`)} />
            <Stop offset="1" {...stopPaint(`hsl(${(hue + 40) % 360}, 45%, 28%)`)} />
          </RadialGradient>
        </Defs>
        <Circle cx={16} cy={16} r={16} fill={`url(#${id})`} />
      </Svg>
      {initials ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.initials, { color: color.markGlyph, fontSize: Math.round(size * 0.36) }]}>{address.slice(0, 2)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: FONT.dataStrong },
});
