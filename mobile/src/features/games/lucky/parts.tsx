import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";
import { explorerUrl, openExternal } from "~/lib/external";
import { shortHex } from "@agari/core/units";
import { FONT, useTheme } from "~/theme";
import { luckyTokens, type LuckyTokens } from "~/theme/web/games-lucky";
import { PIXEL_FONT } from "~/theme/web/games";

/** The Lucky cabinet's computed web colours for the current theme, beside the app's roles. */
export function useLuckyTokens(): { lk: LuckyTokens; color: ReturnType<typeof useTheme>["color"] } {
  const { name, color } = useTheme();
  return { lk: luckyTokens(name), color };
}

/** web's clock ramp (stage/StageFace `clockUrgency`): calm, vermilion inside ten minutes, loss inside two. */
export function clockInk(remainingSec: number, color: ReturnType<typeof useTheme>["color"]): string {
  return remainingSec <= 120 ? color.loss : remainingSec <= 600 ? color.accent : color.profit;
}

/** stage.css `.st-band`: radius 10, a hairline, the well's ground and the raised lip. `.lk-section` pads it 10 × 12. */
export function Band({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { lk, color } = useLuckyTokens();
  return <View style={[styles.band, { borderColor: color.hairline, backgroundColor: lk.well, boxShadow: lk.bandShadow }, style]}>{children}</View>;
}

/** `.lk-section-k`: the band's label, pixel 12, 0.2em, vermilion at 80 %. */
export function SectionK({ children }: { children: string }) {
  const { lk } = useLuckyTokens();
  return <Text style={[styles.sectionK, { color: lk.sectionK }]}>{children.toUpperCase()}</Text>;
}

/** stage.css `.st-cadence`: the Window's length as a pixel pill. */
export function Cadence({ label }: { label: string }) {
  const { lk, color } = useLuckyTokens();
  return (
    <View style={[styles.cadence, { borderColor: lk.cadenceBorder }]}>
      <Text style={[styles.cadenceText, { color: color.inkSecondary }]}>{label}</Text>
    </View>
  );
}

/** `.lk-link`: mono 10, 0.06em, uppercase, vermilion — a text button. */
export function LinkWord({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: StyleProp<TextStyle> }) {
  const { color } = useLuckyTokens();
  return (
    <Text
      onPress={disabled ? undefined : onPress}
      accessibilityRole="link"
      accessibilityState={{ disabled: !!disabled }}
      suppressHighlighting={false}
      style={[styles.link, { color: color.accent }, disabled && styles.off, style]}
    >
      {label.toUpperCase()}
    </Text>
  );
}

/** `.lk-plate-foot` "Transaction <hash>": the short signature, dotted-underlined, opening the explorer. */
export function TxLine({ label, hash }: { label: string; hash: string }) {
  const { color } = useLuckyTokens();
  return (
    <Text style={[styles.foot, { color: color.inkMuted }]}>
      {label}{" "}
      <Text onPress={() => void openExternal(explorerUrl("tx", hash))} accessibilityRole="link" style={[styles.hash, { textDecorationColor: color.inkMuted }]}>
        {shortHex(hash)}
      </Text>
    </Text>
  );
}

/**
 * stage.css `.crt-screen` behind a Lucky face: the gradient ground, the two inset shadows, the 2 px scanlines
 * blended over the art, and the four corner screws. Web's 22 / 14 elliptical corner is drawn as radius 18.
 */
export function CrtFace({ children, height, style }: { children: ReactNode; height: number; style?: StyleProp<ViewStyle> }) {
  const { lk, color } = useLuckyTokens();
  return (
    <View style={[styles.face, { height, borderColor: color.hairline, experimental_backgroundImage: lk.faceGradient, boxShadow: lk.faceShadow }, style]}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blend]}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="lk-scan" width={4} height={2} patternUnits="userSpaceOnUse">
              <Rect x={0} y={1} width={4} height={1} fill={lk.scanline} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#lk-scan)" />
        </Svg>
      </View>
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <View key={corner} pointerEvents="none" style={[styles.screw, SCREW[corner], { backgroundColor: lk.screw }]} />
      ))}
    </View>
  );
}

const SCREW = StyleSheet.create({
  tl: { top: 4, left: 4 },
  tr: { top: 4, right: 4 },
  bl: { bottom: 4, left: 4 },
  br: { bottom: 4, right: 4 },
});

export const LUCKY_TEXT = StyleSheet.create({
  /** `.lk-meta` / `.lk-plate-foot`: mono 10 / 1.6, gray-500. */
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  /** `.lk-caption`: mono 10 / 1.6, gray-400 (profit while live). */
  caption: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  /** `.lk-plate-body` / `.lk-intro`: Inter 13 / 1.65. */
  body: { fontFamily: FONT.body, fontSize: 13, lineHeight: 21.45 },
  /** `.lk-deal-title` / `.lk-plate-title`: pixel 22, 0.12em, uppercase. */
  pixelTitle: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 26, letterSpacing: 2.64 },
  /** `.du-k`: mono 9, 0.12em, uppercase, gray-500. */
  k: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08 },
  /** `.du-v`: mono 14. */
  v: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4 },
});

const styles = StyleSheet.create({
  band: { position: "relative", borderRadius: 10, borderWidth: 1, gap: 6, paddingVertical: 10, paddingHorizontal: 12 },
  sectionK: { fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 19.2, letterSpacing: 2.4 },
  cadence: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 9999, borderWidth: 1 },
  cadenceText: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66 },
  link: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.6 },
  off: { opacity: 0.5 },
  foot: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  hash: { textDecorationLine: "underline", textDecorationStyle: "dotted" },
  face: { position: "relative", overflow: "hidden", borderRadius: 18, borderWidth: 1, alignItems: "center" },
  blend: { mixBlendMode: "overlay", zIndex: 2 },
  screw: { position: "absolute", width: 6, height: 6, zIndex: 4 },
});
