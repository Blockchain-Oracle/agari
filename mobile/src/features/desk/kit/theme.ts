import { StyleSheet } from "react-native";
import { FONT, useTheme } from "~/theme";
import { deskCockpitTokens } from "~/theme/web/products/desk-cockpit";

/** The palette, the desk's mixed tokens and whether the page is dark, as every desk surface reads them. */
export function useDeskTheme() {
  const { name, color } = useTheme();
  return { color, t: deskCockpitTokens(name), dark: name === "dark" };
}

/**
 * web's text utilities as the desk pages compute them at 402 px. `--font-data` resolves to the inherited Inter on
 * useagari.xyz (the dumps print no family for it), `--font-mono` to JetBrains Mono, `--font-display` to Sora.
 */
export const DT = StyleSheet.create({
  /** `.type-caption` */
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  /** `.type-body` */
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  /** `.dk-panel-title`, font-mono 11 px, 0.12 em. */
  panelTitle: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.32, textTransform: "uppercase" },
  /** `.cp-stat-label`, `.dc-subhead` (font-data 10.5 px, 0.12 em). */
  statLabel: { fontFamily: FONT.body, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 1.26, textTransform: "uppercase" },
  /** `.dk-eyebrow`, font-mono 11 px, 0.14 em. */
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.54, textTransform: "uppercase" },
  /** `.dk-mono` */
  mono: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  /** `.dk-holding-name` */
  holdingName: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24 },
  /** `.dk-title` */
  title: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 31.5, letterSpacing: -0.6 },
  /** `.dk-title-jp` */
  titleJp: { fontFamily: FONT.stamp, fontSize: 13, lineHeight: 20.8 },
});
