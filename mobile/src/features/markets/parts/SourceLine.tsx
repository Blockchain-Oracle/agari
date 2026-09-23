import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { SourceLabel } from "@/features/markets/price-source/source-label";
import { openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";

/** Pyth's "P" (web's SponsorLogos PYTH_PATHS, the first 20 units), inked in the text colour. */
const PYTH_P = [
  "M11.857 9.599c0 1.325-1.072 2.4-2.394 2.4v2.4a4.794 4.794 0 0 0 4.787-4.8c0-2.651-2.144-4.8-4.787-4.8A4.797 4.797 0 0 0 4.676 9.6v12L7.07 24V9.6c0-1.325 1.071-2.4 2.393-2.4a2.397 2.397 0 0 1 2.394 2.4Z",
  "M9.464 0a9.51 9.51 0 0 0-4.787 1.285 9.591 9.591 0 0 0-2.393 1.966A9.577 9.577 0 0 0-.11 9.6v7.2l2.394 2.4V9.6a7.189 7.189 0 0 1 7.18-7.2c3.966 0 7.18 3.224 7.18 7.2s-3.216 7.2-7.18 7.2v2.4c5.288 0 9.573-4.298 9.573-9.6S14.752 0 9.464 0Z",
] as const;

/** PreStocks' hexagon, the file web serves (sponsor marks are permitted, 09-23). */
const PRESTOCKS_MARK = require("../../../../../web/public/brand/sponsors/prestocks-mark.svg");

const MARK = 14;

/**
 * web's price-source SourceLine: "Settles on Pyth · TSLA/USD" beside the sponsor's own mark; where the feed has a
 * public page (Pyth Terminal, the mint on Explorer) the line opens it outside the app.
 */
export function SourceLine({ label, tone = "muted" }: { label: SourceLabel | null; tone?: "muted" | "secondary" }) {
  const { color } = useTheme();
  if (!label) return null;
  const ink = tone === "muted" ? color.inkMuted : color.inkSecondary;
  const mark =
    label.provider === "pyth" ? (
      <Svg width={MARK * (20 / 24)} height={MARK} viewBox="0 0 20 24">
        {PYTH_P.map((d) => (
          <Path key={d.slice(0, 12)} d={d} fill={ink} />
        ))}
      </Svg>
    ) : label.provider === "prestocks" ? (
      <Image source={PRESTOCKS_MARK} style={styles.hex} contentFit="contain" accessible={false} />
    ) : null;
  const body = (
    <View style={styles.row}>
      {mark}
      <Text style={[styles.text, { color: label.href ? color.accent : ink }]} numberOfLines={1}>
        {label.text}
      </Text>
      {label.href ? <SymbolView name={{ ios: "arrow.up.right", android: "north_east" }} size={11} tintColor={color.accent} /> : null}
    </View>
  );
  if (!label.href) return body;
  const href = label.href;
  return (
    <Pressable onPress={() => openExternal(href)} accessibilityRole="link" accessibilityLabel={label.text} hitSlop={10}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 22 },
  hex: { width: MARK, height: MARK, borderRadius: 3 },
  text: { fontFamily: FONT.data, fontSize: 11.5, flexShrink: 1 },
});
