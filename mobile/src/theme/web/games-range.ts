import type { ThemeName } from "../index";

/**
 * web's Range and Moonshot pages as the browser computes them at 402 px, per theme: the parlay page's frame they sit
 * on (parlay-page.css, parlay-builder.css, parlay-ticket.css), the band control (range-band.css), the aim ladder
 * (moonshot.css) and CapabilityPending (shell.css). The white-alpha steps map to part-14's ink ladder in light.
 * Roles that equal a `useTheme().color` value (ink, the grays, vermilion, profit, loss) and the games frame's own
 * card ground (`gamesTokens().cardBg / cardBorder`) are read from there.
 */
const DARK = {
  gray300: "#D4D4D4", gray700: "#404040",
  eyebrow: "rgba(224, 77, 38, 0.8)",
  plate: "rgba(23, 23, 23, 0.6)", headRule: "rgba(255, 255, 255, 0.05)", slipEmpty: "rgba(23, 23, 23, 0.2)",
  menuOn: "rgba(255, 255, 255, 0.1)", cpRule: "rgba(255, 255, 255, 0.08)",
  // range-band.css
  bandLabel: "rgba(255, 255, 255, 0.45)", bandMust: "rgba(255, 255, 255, 0.35)", bandBorder: "rgba(255, 255, 255, 0.1)", bandBg: "rgba(255, 255, 255, 0.015)",
  k: "rgba(255, 255, 255, 0.3)", arrow: "rgba(255, 255, 255, 0.2)", trackLine: "rgba(255, 255, 255, 0.1)", spotTick: "rgba(255, 255, 255, 0.8)", spotDot: "#FFFFFF",
  footRule: "rgba(255, 255, 255, 0.07)", footInk: "rgba(255, 255, 255, 0.35)", footV: "rgba(255, 255, 255, 0.65)", wait: "rgba(255, 255, 255, 0.3)",
  presetBorder: "rgba(255, 255, 255, 0.09)", presetInk: "rgba(255, 255, 255, 0.45)", presetOnBorder: "rgba(224, 77, 38, 0.7)", presetOnBg: "rgba(224, 77, 38, 0.08)", presetSpan: "rgba(255, 255, 255, 0.3)",
  centerRule: "rgba(255, 255, 255, 0.08)", centerV: "rgba(255, 255, 255, 0.6)", iconBorder: "rgba(255, 255, 255, 0.1)", iconInk: "rgba(255, 255, 255, 0.55)",
  sidesBorder: "rgba(255, 255, 255, 0.08)", sidesBg: "rgba(255, 255, 255, 0.015)", sideInk: "rgba(255, 255, 255, 0.4)", sideOnBg: "rgba(224, 77, 38, 0.12)",
  thumbFill: "rgba(224, 77, 38, 0.25)", thumbFillDrag: "rgba(224, 77, 38, 0.45)", grip: "rgba(224, 77, 38, 0.8)",
  // parlay-ticket.css
  solverBg: "rgba(255, 255, 255, 0.02)", solverBorder: "rgba(255, 255, 255, 0.05)", modesBorder: "rgba(255, 255, 255, 0.1)", modeOnBg: "rgba(224, 77, 38, 0.15)",
  inputBg: "rgba(255, 255, 255, 0.03)", inputBorder: "rgba(255, 255, 255, 0.08)", inputFocus: "rgba(255, 255, 255, 0.2)",
  placeInk: "#FFFFFF", placeGlow: "rgba(224, 77, 38, 0.25)", placeMutedBg: "rgba(255, 255, 255, 0.06)", placeMutedBorder: "rgba(255, 255, 255, 0.1)",
  lossSoft: "rgba(251, 113, 133, 0.9)", lossHalf: "rgba(251, 113, 133, 0.5)", lossDim: "rgba(251, 113, 133, 0.6)",
  errBg: "rgba(244, 63, 94, 0.1)", errBorder: "rgba(244, 63, 94, 0.2)", txLink: "rgba(52, 211, 153, 0.6)", spin: "rgba(224, 77, 38, 0.6)",
  // parlay-page.css: the slip's cards
  pillBg: "rgba(255, 255, 255, 0.05)", pillWonBg: "rgba(224, 77, 38, 0.15)",
  cardWonBorder: "rgba(224, 77, 38, 0.4)", cardWonBg: "rgba(224, 77, 38, 0.04)", cardLostBorder: "rgba(255, 255, 255, 0.06)", cardLostBg: "rgba(23, 23, 23, 0.3)",
  legRule: "rgba(255, 255, 255, 0.05)", settleBorder: "rgba(224, 77, 38, 0.5)",
  // moonshot.css
  ladderMid: "rgba(255, 255, 255, 0.14)", rungBorder: "rgba(255, 255, 255, 0.09)", rungInk: "rgba(255, 255, 255, 0.45)",
  longOnBorder: "rgba(52, 211, 153, 0.7)", longOnBg: "rgba(52, 211, 153, 0.12)", shortOnBorder: "rgba(251, 113, 133, 0.7)", shortOnBg: "rgba(251, 113, 133, 0.12)",
  hint: "rgba(255, 255, 255, 0.4)",
};

const LIGHT: typeof DARK = {
  gray300: "#453E33", gray700: "#C4BAA6",
  eyebrow: "rgba(217, 62, 31, 0.8)",
  plate: "rgba(251, 247, 238, 0.94)", headRule: "rgba(20, 18, 16, 0.07)", slipEmpty: "rgba(251, 247, 238, 0.94)",
  menuOn: "rgba(20, 18, 16, 0.08)", cpRule: "rgba(20, 18, 16, 0.12)",
  bandLabel: "rgba(20, 18, 16, 0.62)", bandMust: "rgba(20, 18, 16, 0.55)", bandBorder: "rgba(20, 18, 16, 0.12)", bandBg: "rgba(20, 18, 16, 0.02)",
  k: "rgba(20, 18, 16, 0.5)", arrow: "rgba(20, 18, 16, 0.3)", trackLine: "rgba(20, 18, 16, 0.14)", spotTick: "rgba(20, 18, 16, 0.8)", spotDot: "rgba(20, 18, 16, 0.9)",
  footRule: "rgba(20, 18, 16, 0.1)", footInk: "rgba(20, 18, 16, 0.55)", footV: "rgba(20, 18, 16, 0.75)", wait: "rgba(20, 18, 16, 0.5)",
  presetBorder: "rgba(20, 18, 16, 0.12)", presetInk: "rgba(20, 18, 16, 0.62)", presetOnBorder: "rgba(217, 62, 31, 0.7)", presetOnBg: "rgba(217, 62, 31, 0.08)", presetSpan: "rgba(20, 18, 16, 0.5)",
  centerRule: "rgba(20, 18, 16, 0.1)", centerV: "rgba(20, 18, 16, 0.75)", iconBorder: "rgba(20, 18, 16, 0.14)", iconInk: "rgba(20, 18, 16, 0.65)",
  sidesBorder: "rgba(20, 18, 16, 0.1)", sidesBg: "rgba(20, 18, 16, 0.02)", sideInk: "rgba(20, 18, 16, 0.62)", sideOnBg: "rgba(217, 62, 31, 0.12)",
  thumbFill: "rgba(217, 62, 31, 0.25)", thumbFillDrag: "rgba(217, 62, 31, 0.45)", grip: "rgba(217, 62, 31, 0.8)",
  solverBg: "rgba(20, 18, 16, 0.03)", solverBorder: "rgba(20, 18, 16, 0.07)", modesBorder: "rgba(20, 18, 16, 0.11)", modeOnBg: "rgba(217, 62, 31, 0.15)",
  inputBg: "rgba(20, 18, 16, 0.03)", inputBorder: "rgba(20, 18, 16, 0.11)", inputFocus: "rgba(20, 18, 16, 0.22)",
  placeInk: "#FFFFFF", placeGlow: "rgba(224, 77, 38, 0.25)", placeMutedBg: "rgba(20, 18, 16, 0.05)", placeMutedBorder: "rgba(20, 18, 16, 0.11)",
  lossSoft: "rgba(194, 56, 31, 0.9)", lossHalf: "rgba(194, 56, 31, 0.5)", lossDim: "rgba(194, 56, 31, 0.6)",
  errBg: "rgba(244, 63, 94, 0.1)", errBorder: "rgba(244, 63, 94, 0.2)", txLink: "rgba(46, 107, 79, 0.6)", spin: "rgba(217, 62, 31, 0.6)",
  pillBg: "rgba(20, 18, 16, 0.05)", pillWonBg: "rgba(217, 62, 31, 0.15)",
  cardWonBorder: "rgba(217, 62, 31, 0.4)", cardWonBg: "rgba(217, 62, 31, 0.06)", cardLostBorder: "rgba(20, 18, 16, 0.07)", cardLostBg: "rgba(251, 247, 238, 0.94)",
  legRule: "rgba(20, 18, 16, 0.07)", settleBorder: "rgba(217, 62, 31, 0.5)",
  ladderMid: "rgba(20, 18, 16, 0.16)", rungBorder: "rgba(20, 18, 16, 0.12)", rungInk: "rgba(20, 18, 16, 0.62)",
  longOnBorder: "rgba(46, 107, 79, 0.7)", longOnBg: "rgba(46, 107, 79, 0.12)", shortOnBorder: "rgba(194, 56, 31, 0.7)", shortOnBg: "rgba(194, 56, 31, 0.12)",
  hint: "rgba(20, 18, 16, 0.55)",
};

export type RangeTokens = typeof DARK;
export const rangeTokens = (name: ThemeName): RangeTokens => (name === "dark" ? DARK : LIGHT);
