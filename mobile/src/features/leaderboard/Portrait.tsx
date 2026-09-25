import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { glyphFromAddress } from "@/features/leaderboard/glyph";
import { useTheme } from "~/theme";
import { leaderboardTokens } from "~/theme/web/explore/leaderboard";

interface Props {
  address: string;
  size: number;
  /** The 135° stops: `.podium-portrait` gold, the champion's fire, or `.bz-portrait`'s two. */
  stops: readonly string[];
  border: string;
  borderWidth: number;
  ink: string;
  fontFamily: string;
  fontSize: number;
  letterSpacing?: number;
  /** web's id for the gradient defs — unique per disc on screen. */
  id: string;
}

/**
 * web's round glyph portrait (`.podium-portrait`, `.bz-portrait`): the address's `glyphFromAddress` letter on a 135°
 * gradient disc under the `::after` highlight — a white radial at 30 % 25 % fading by half the radius.
 */
export function Portrait({ address, size, stops, border, borderWidth, ink, fontFamily, fontSize, letterSpacing, id }: Props) {
  const { name } = useTheme();
  const t = leaderboardTokens(name);
  const step = stops.length > 1 ? 1 / (stops.length - 1) : 1;
  return (
    <View style={[styles.disc, { width: size, height: size, borderRadius: size / 2, borderWidth, borderColor: border }]} accessible={false}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            {stops.map((stop, i) => (
              <Stop key={stop + i} offset={i * step} stopColor={stop} />
            ))}
          </LinearGradient>
          <RadialGradient id={`${id}-h`} cx="30%" cy="25%" r="50%" fx="30%" fy="25%">
            <Stop offset="0" stopColor={t.highlight} />
            <Stop offset="1" stopColor={t.highlightClear} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}-g)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}-h)`} />
      </Svg>
      <Text style={{ color: ink, fontFamily, fontSize, letterSpacing }}>{glyphFromAddress(address)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
