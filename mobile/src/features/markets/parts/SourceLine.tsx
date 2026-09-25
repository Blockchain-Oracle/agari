import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { SourceLabel } from "@/features/markets/price-source/source-label";
import { openExternal } from "~/lib/external";
import { useMk } from "../hero/mk";

/** Pyth's "P" (web's SponsorLogos PYTH_PATHS, the first 20 units), inked in the line's colour. */
const PYTH_P = [
  "M11.857 9.599c0 1.325-1.072 2.4-2.394 2.4v2.4a4.794 4.794 0 0 0 4.787-4.8c0-2.651-2.144-4.8-4.787-4.8A4.797 4.797 0 0 0 4.676 9.6v12L7.07 24V9.6c0-1.325 1.071-2.4 2.393-2.4a2.397 2.397 0 0 1 2.394 2.4Z",
  "M9.464 0a9.51 9.51 0 0 0-4.787 1.285 9.591 9.591 0 0 0-2.393 1.966A9.577 9.577 0 0 0-.11 9.6v7.2l2.394 2.4V9.6a7.189 7.189 0 0 1 7.18-7.2c3.966 0 7.18 3.224 7.18 7.2s-3.216 7.2-7.18 7.2v2.4c5.288 0 9.573-4.298 9.573-9.6S14.752 0 9.464 0Z",
] as const;

/** PreStocks' hexagon, the file web serves (sponsor marks are permitted, 09-23). */
const PRESTOCKS_MARK = require("../../../../../web/public/brand/sponsors/prestocks-mark.svg");

/**
 * web's price-source SourceLine (source-line.css): the container's own type (`.pair-meta` in the hero head), the
 * sponsor's mark at 1.05em before the text, and — where the feed has a public page — the text as a hairline-underlined
 * link with its ↗, opened outside the app.
 */
export function SourceLine({ label, textStyle }: { label: SourceLabel | null; textStyle: StyleProp<TextStyle> }) {
  const mk = useMk();
  if (!label) return null;
  const size = (StyleSheet.flatten(textStyle)?.fontSize ?? 9) * 1.05;
  const ink = StyleSheet.flatten(textStyle)?.color ?? mk.gray400;
  const mark =
    label.provider === "pyth" ? (
      <Svg width={size * (20 / 24)} height={size} viewBox="0 0 20 24">
        {PYTH_P.map((d) => (
          <Path key={d.slice(0, 12)} d={d} fill={typeof ink === "string" ? ink : mk.gray400} />
        ))}
      </Svg>
    ) : label.provider === "prestocks" ? (
      <Image source={PRESTOCKS_MARK} style={{ width: size, height: size }} contentFit="contain" accessible={false} />
    ) : null;
  const line = (
    <Text style={textStyle}>
      {mark ? <Text>{mark} </Text> : null}
      {label.href ? (
        <Text style={[styles.link, { textDecorationColor: mk.gray700 }]}>
          {label.text}
          <Text style={styles.arrow}> ↗</Text>
        </Text>
      ) : (
        label.text
      )}
    </Text>
  );
  if (!label.href) return line;
  const href = label.href;
  return (
    <Pressable onPress={() => openExternal(href)} accessibilityRole="link" accessibilityLabel={label.text} hitSlop={8}>
      {line}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { textDecorationLine: "underline" },
  arrow: { textDecorationLine: "none" },
});
