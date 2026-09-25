import { StyleSheet } from "react-native";
import { FONT, useTheme } from "~/theme";
import { marketsTokens, type MarketsTokens } from "~/theme/web/markets";

/** The /markets page's web tokens for the theme in force. */
export function useMk(): MarketsTokens {
  return marketsTokens(useTheme().name);
}

/**
 * The hero panel's type as web computes it at 402 px (markets-hero.css, yosuku part-04/16; letter-spacing em →
 * points at each size).
 */
export const mkType = StyleSheet.create({
  /** .mh-asset-label */
  assetLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
  /** .mh-cadence */
  cadence: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26, textAlign: "center" },
  /** .mh-question */
  question: { fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 25.2, letterSpacing: -0.6 },
  /** .hero-chart-head .pair-meta at phone width */
  pairMeta: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.27, marginTop: 3 },
  /** .mh-distance */
  distance: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4 },
  distanceValue: { fontFamily: FONT.dataStrong, fontSize: 14, lineHeight: 22.4 },
  /** .mh-distance .mh-since */
  since: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  /** .mh-settles-label / -value */
  settlesLabel: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase", marginBottom: 4, textAlign: "right" },
  settlesValue: { fontFamily: FONT.dataStrong, fontSize: 24, lineHeight: 38.4, textAlign: "right", fontVariant: ["tabular-nums"] },
  /** .hero-chart-foot */
  foot: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.6 },
  /** .mh-room, the foot's .alerts-button */
  action: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
});
