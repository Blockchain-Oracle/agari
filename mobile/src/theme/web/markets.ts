import type { ThemeName } from "../index";

/**
 * web's /markets page frame on a phone as the browser computes it at 402 px, per theme: the hero section and its
 * `.hero-chart` panel (head, cadence tabs, question, distance, settles, canvas, foot, the Room and Alert controls, the
 * ramp, `.hero-yesno`), the alerts popover (alerts.css), the lanes header's session chip (market-session.css) and the
 * Sensei dock (yosuku part-02). markets-hero.css, asset-hero.css, yosuku part-04/14/16; read off useagari.xyz. Where
 * web's light rules leave a dark-canvas white alpha in place (the hero rule, the panel border), the computed value is
 * kept: that is what a phone shows.
 */
const DARK = {
  ink: "#FFFFFF", gray300: "#D4D4D4", gray700: "#404040", gray400: "#A3A3A3", gray500: "#737373", gray600: "#525252", vermilion: "#E04D26",
  profit: "#34D399", loss: "#FB7185",
  // section.page-hero.markets-hero
  heroRule: "rgba(255, 255, 255, 0.06)",
  // .hero-chart
  panelBg: "#050505", panelBorder: "rgba(255, 255, 255, 0.08)",
  // .mh-cadence
  cadence: "rgba(255, 255, 255, 0.35)", cadenceOff: "rgba(255, 255, 255, 0.15)",
  // .mh-settles.urgent .mh-settles-label
  urgentLabel: "rgba(224, 77, 38, 0.7)",
  // .hero-chart-foot, .mh-room, .alerts-button, .ramp
  footBg: "rgba(5, 5, 5, 0.5)", footRule: "rgba(255, 255, 255, 0.05)", footAction: "rgba(255, 255, 255, 0.45)", roomMeta: "rgba(255, 255, 255, 0.2)",
  rampBar: "rgba(255, 255, 255, 0.08)", rampFrom: "#E04D26", rampTo: "#FFFFFF",
  // .hyn-yes / .hyn-no
  upBg: "rgba(52, 211, 153, 0.08)", upBorder: "rgba(52, 211, 153, 0.32)", downBg: "rgba(251, 113, 133, 0.08)", downBorder: "rgba(251, 113, 133, 0.32)",
  // .alerts-pop
  popBg: "rgba(23, 23, 23, 0.96)", popBorder: "rgba(255, 255, 255, 0.1)", popQuiet: "#737373", popRule: "rgba(255, 255, 255, 0.05)",
  dirBorder: "rgba(255, 255, 255, 0.1)", aboveBg: "rgba(52, 211, 153, 0.1)", aboveBorder: "rgba(52, 211, 153, 0.2)", belowBg: "rgba(251, 113, 133, 0.1)", belowBorder: "rgba(251, 113, 133, 0.2)",
  inputBg: "rgba(255, 255, 255, 0.05)", inputBorder: "rgba(255, 255, 255, 0.1)", plusBg: "rgba(224, 77, 38, 0.2)",
  rowLabel: "#A3A3A3", remove: "#525252",
  // .mks-chip
  chipHoliday: "rgba(224, 77, 38, 0.55)",
  // .sensei-dock / .sensei-teaser
  dockBg: "rgba(23, 19, 16, 0.93)", dockRing: "rgba(224, 77, 38, 0.22)", dockShadow: "#000000", dockTrack: "rgba(255, 255, 255, 0.12)", dockGlyph: "#FFFFFF",
  teaserInk: "#FFFFFF", teaserShadow: "#E04D26",
};

const LIGHT: typeof DARK = {
  ink: "#141210", gray300: "#453E33", gray700: "#C4BAA6", gray400: "#5E574B", gray500: "#7C7466", gray600: "#9A9080", vermilion: "#D93E1F",
  profit: "#2E6B4F", loss: "#C2381F",
  heroRule: "rgba(255, 255, 255, 0.06)",
  panelBg: "#F4EEE3", panelBorder: "rgba(255, 255, 255, 0.08)",
  cadence: "rgba(20, 18, 16, 0.5)", cadenceOff: "rgba(20, 18, 16, 0.4)",
  urgentLabel: "rgba(217, 62, 31, 0.7)",
  footBg: "rgba(20, 18, 16, 0.035)", footRule: "rgba(20, 18, 16, 0.08)", footAction: "rgba(20, 18, 16, 0.62)", roomMeta: "rgba(20, 18, 16, 0.4)",
  rampBar: "rgba(20, 18, 16, 0.1)", rampFrom: "#D93E1F", rampTo: "#E6A489",
  upBg: "rgba(52, 211, 153, 0.08)", upBorder: "rgba(52, 211, 153, 0.32)", downBg: "rgba(251, 113, 133, 0.08)", downBorder: "rgba(251, 113, 133, 0.32)",
  popBg: "rgba(251, 247, 238, 0.94)", popBorder: "rgba(20, 18, 16, 0.12)", popQuiet: "rgba(20, 18, 16, 0.62)", popRule: "rgba(20, 18, 16, 0.08)",
  dirBorder: "rgba(20, 18, 16, 0.1)", aboveBg: "rgba(46, 107, 79, 0.1)", aboveBorder: "rgba(46, 107, 79, 0.2)", belowBg: "rgba(194, 56, 31, 0.1)", belowBorder: "rgba(194, 56, 31, 0.2)",
  inputBg: "rgba(20, 18, 16, 0.05)", inputBorder: "rgba(20, 18, 16, 0.12)", plusBg: "rgba(217, 62, 31, 0.2)",
  rowLabel: "rgba(20, 18, 16, 0.8)", remove: "rgba(20, 18, 16, 0.4)",
  chipHoliday: "rgba(217, 62, 31, 0.55)",
  dockBg: "rgba(255, 255, 255, 0.95)", dockRing: "rgba(224, 77, 38, 0.22)", dockShadow: "#281206", dockTrack: "rgba(20, 18, 16, 0.12)", dockGlyph: "#1A1613",
  teaserInk: "#FFFFFF", teaserShadow: "#D93E1F",
};

export type MarketsTokens = typeof DARK;
export const marketsTokens = (name: ThemeName): MarketsTokens => (name === "dark" ? DARK : LIGHT);

/** web's `.markets-hero` padding-top is 116 under a 94 px fixed chrome that the app lays out above the screen: 50 remain. */
export const HERO_TOP = 50;
