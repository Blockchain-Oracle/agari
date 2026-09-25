import type { ThemeName } from "../index";

/**
 * web's §01 live-windows rail as the browser computes it at 402 px, per theme: the lane tabs (ui/tabs `line` list),
 * the ticker picker (`.asset-tabs.tkp`), the market card and every `.mc-*` block (yosuku part-06/16, the light
 * re-inks in part-14 and market-card.css), the pending slot (`.market-card-pending`, ticker-picker.css) and the pager.
 * Read off useagari.xyz. Where web's light rules leave a dark-canvas white alpha in place (the card's hairlines), the
 * computed value is kept: that is what a phone shows.
 */
const DARK = {
  ink: "#FFFFFF", inkSecondary: "#A3A3A3", inkMuted: "#737373", gray600: "#525252", gray200: "#E5E5E5", vermilion: "#E04D26",
  profit: "#34D399", loss: "#FB7185",
  // .market-card / .mc-head / .mc-foot hairlines
  cardBg: "rgba(255, 255, 255, 0.012)", cardBorder: "rgba(255, 255, 255, 0.06)", cardRule: "rgba(255, 255, 255, 0.05)",
  // .market-card-pending
  pendingBg: "rgba(255, 255, 255, 0.008)", pendingBorder: "rgba(255, 255, 255, 0.06)",
  pendingRing: "rgba(224, 77, 38, 0.45)", pendingRingOut: "rgba(224, 77, 38, 0)",
  // .mc-kind
  kindBorder: "rgba(224, 77, 38, 0.45)",
  // .mc-spark
  sparkWash: "rgba(255, 255, 255, 0.02)", sparkWashEnd: "rgba(0, 0, 0, 0)", strikeFill: "rgba(224, 77, 38, 0.4)", strikeTickBg: "rgba(5, 5, 5, 0.7)",
  // .mc-strip and its ramp
  stripBg: "rgba(0, 0, 0, 0)", stripRule: "rgba(255, 255, 255, 0.05)", stripInk: "#525252",
  rampBar: "rgba(255, 255, 255, 0.08)", rampFrom: "#E04D26", rampTo: "#FFFFFF",
  // .mc-side
  upBg: "rgba(52, 211, 153, 0.08)", upBorder: "rgba(52, 211, 153, 0.32)", downBg: "rgba(251, 113, 133, 0.08)", downBorder: "rgba(251, 113, 133, 0.32)",
  // .mc-room
  roomBg: "rgba(255, 255, 255, 0.015)", roomBorder: "rgba(255, 255, 255, 0.06)", roomInk: "rgba(255, 255, 255, 0.55)",
  // .pager
  pagerRule: "rgba(255, 255, 255, 0.1)",
};

const LIGHT: typeof DARK = {
  ink: "#141210", inkSecondary: "#5E574B", inkMuted: "#7C7466", gray600: "#9A9080", gray200: "#2E2821", vermilion: "#D93E1F",
  profit: "#2E6B4F", loss: "#C2381F",
  cardBg: "#FBF7EE", cardBorder: "rgba(255, 255, 255, 0.06)", cardRule: "rgba(255, 255, 255, 0.05)",
  pendingBg: "rgba(20, 18, 16, 0.015)", pendingBorder: "rgba(20, 18, 16, 0.16)",
  pendingRing: "rgba(224, 77, 38, 0.45)", pendingRingOut: "rgba(224, 77, 38, 0)",
  kindBorder: "rgba(217, 62, 31, 0.45)",
  sparkWash: "rgba(255, 255, 255, 0.02)", sparkWashEnd: "rgba(0, 0, 0, 0)", strikeFill: "rgba(224, 77, 38, 0.4)", strikeTickBg: "rgba(251, 247, 238, 0.85)",
  stripBg: "rgba(20, 18, 16, 0.035)", stripRule: "rgba(20, 18, 16, 0.08)", stripInk: "#9A9080",
  rampBar: "rgba(20, 18, 16, 0.1)", rampFrom: "#D93E1F", rampTo: "#E6A489",
  upBg: "rgba(52, 211, 153, 0.08)", upBorder: "rgba(52, 211, 153, 0.32)", downBg: "rgba(251, 113, 133, 0.08)", downBorder: "rgba(251, 113, 133, 0.32)",
  roomBg: "rgba(20, 18, 16, 0.035)", roomBorder: "rgba(20, 18, 16, 0.08)", roomInk: "rgba(20, 18, 16, 0.62)",
  pagerRule: "rgba(20, 18, 16, 0.12)",
};

export type LanesTokens = typeof DARK;
export const lanesTokens = (name: ThemeName): LanesTokens => (name === "dark" ? DARK : LIGHT);

/** `.mc-cadence` is Noto Serif JP 500 (fonts.ts loads it under this key; theme/type.ts names only the 700 stamp). */
export const SERIF_MEDIUM = "NotoSerifJP_500Medium";
