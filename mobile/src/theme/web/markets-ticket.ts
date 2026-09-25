import type { ThemeName } from "../index";

/**
 * web's phone ticket as the browser computes it at 402 px, per theme: the drawer (`.tk-drawer`), its head and mini
 * chart, the mode tray, the side segments, "Betting against", the amount and price blocks, the leverage chips, the
 * readout strip, the gates, Public / Private, the CTA and the footnote (ticket.css, ticket-composer.css,
 * ticket-composer-light.css, preopen.css, private-ticket.css, components/ui button + switch). Read off useagari.xyz.
 * Where web's light rule out-ranks a pressed state (the 1× chip, the pressed mode tile), the computed value is kept.
 */
const DARK = {
  drawerBg: "#0B0B0E", close: "#525252", drawerEdge: "rgba(255, 255, 255, 0.1)",
  ink: "#FFFFFF", inkSecondary: "#A3A3A3", inkMuted: "#737373", vermilion: "#E04D26",
  // .tk-mini-chart and the lightweight-charts canvas inside it
  miniBorder: "rgba(255, 255, 255, 0.08)", miniBg: "rgba(255, 255, 255, 0.016)",
  chartGrid: "rgba(255, 255, 255, 0.1)", chartText: "#737373", chartLine: "#FFFFFF", chartLineLabelInk: "#000000",
  chartPriceLine: "#A3A3A3", chartPriceLabelInk: "#000000",
  // .tk-modes / .tk-mode
  modesBorder: "rgba(255, 255, 255, 0.08)", modesBg: "rgba(255, 255, 255, 0.015)", mode: "rgba(255, 255, 255, 0.4)",
  modeOnBg: "rgba(255, 255, 255, 0.08)", modeOnInk: "#FFFFFF", modePrivateOnBg: "rgba(224, 77, 38, 0.12)",
  // the outline side segments
  sideBorder: "rgba(255, 255, 255, 0.1)", sideIdleBg: "rgba(255, 255, 255, 0.03)",
  up: "#34D399", down: "#FB7185", upFill: "rgba(52, 211, 153, 0.14)", downFill: "rgba(251, 113, 133, 0.14)",
  // .tk-against
  trackBorder: "rgba(255, 255, 255, 0.16)", trackBg: "rgba(255, 255, 255, 0.04)", trackThumb: "rgba(255, 255, 255, 0.55)",
  againstWord: "rgba(255, 255, 255, 0.45)", againstNote: "rgba(255, 255, 255, 0.42)",
  // .tk-amount / .tk-add / .tk-lev / .tk-control-label
  rule: "rgba(255, 255, 255, 0.08)", label: "rgba(255, 255, 255, 0.45)", balance: "rgba(255, 255, 255, 0.35)", placeholder: "rgba(255, 255, 255, 0.18)",
  addBorder: "rgba(255, 255, 255, 0.1)", add: "rgba(255, 255, 255, 0.55)",
  levBorder: "rgba(255, 255, 255, 0.1)", lev: "rgba(255, 255, 255, 0.45)", levOnBorder: "rgba(224, 77, 38, 0.7)", levOnBg: "rgba(224, 77, 38, 0.08)", levOnInk: "#E04D26",
  // .tk-readout / .tk-caption / .tk-note
  cellRule: "rgba(255, 255, 255, 0.07)", liveRule: "rgba(224, 77, 38, 0.3)", readLabel: "rgba(255, 255, 255, 0.3)", readValue: "rgba(255, 255, 255, 0.75)",
  caption: "rgba(255, 255, 255, 0.35)", chance: "rgba(255, 255, 255, 0.55)",
  // .tk-gate
  gateBorder: "rgba(255, 255, 255, 0.08)", gateBg: "rgba(255, 255, 255, 0.02)", warnBorder: "rgba(224, 77, 38, 0.25)", warnBg: "rgba(224, 77, 38, 0.04)",
  gateBody: "#A3A3A3", gateLine: "#737373", gateQuiet: "rgba(255, 255, 255, 0.3)", onVermilion: "#FFFFFF",
  // .tk-pp
  ppBorder: "rgba(255, 255, 255, 0.1)", pp: "rgba(255, 255, 255, 0.4)", ppOnBg: "rgba(255, 255, 255, 0.08)", ppOnInk: "#FFFFFF", ppOff: "rgba(255, 255, 255, 0.2)",
  foot: "rgba(255, 255, 255, 0.25)",
  // .tk-priv-box / .tk-priv-line
  privBorder: "rgba(224, 77, 38, 0.25)", privBg: "rgba(224, 77, 38, 0.05)", privText: "rgba(255, 255, 255, 0.6)",
  // BlockedButton: the side tones, and the blocked face (surface-2, ink-disabled, hairline)
  ctaSideInk: "#141210", blockedBg: "#262626", blockedInk: "#525252", hairline: "rgba(255, 255, 255, 0.1)",
  // OutcomeNote's line (surface-2 on the hairline)
  noteBg: "#262626",
  // components/ui switch, size sm
  switchOff: "rgba(255, 255, 255, 0.08)", switchThumb: "#FFFFFF",
};

const LIGHT: typeof DARK = {
  drawerBg: "#F4EEE3", close: "#9A9080", drawerEdge: "rgba(20, 18, 16, 0.1)",
  ink: "#141210", inkSecondary: "#5E574B", inkMuted: "#7C7466", vermilion: "#D93E1F",
  miniBorder: "rgba(20, 18, 16, 0.11)", miniBg: "rgba(20, 18, 16, 0.02)",
  chartGrid: "rgba(20, 18, 16, 0.12)", chartText: "#7C7466", chartLine: "#141210", chartLineLabelInk: "#FFFFFF",
  chartPriceLine: "#5E574B", chartPriceLabelInk: "#FFFFFF",
  modesBorder: "rgba(20, 18, 16, 0.1)", modesBg: "rgba(20, 18, 16, 0.02)", mode: "rgba(20, 18, 16, 0.62)",
  modeOnBg: "rgba(20, 18, 16, 0.06)", modeOnInk: "rgba(20, 18, 16, 0.62)", modePrivateOnBg: "rgba(217, 62, 31, 0.12)",
  sideBorder: "rgba(20, 18, 16, 0.12)", sideIdleBg: "rgba(20, 18, 16, 0.036)",
  up: "#2E6B4F", down: "#C2381F", upFill: "rgba(46, 107, 79, 0.14)", downFill: "rgba(194, 56, 31, 0.14)",
  trackBorder: "rgba(20, 18, 16, 0.16)", trackBg: "rgba(20, 18, 16, 0.03)", trackThumb: "rgba(20, 18, 16, 0.5)",
  againstWord: "rgba(20, 18, 16, 0.6)", againstNote: "rgba(20, 18, 16, 0.6)",
  rule: "rgba(20, 18, 16, 0.1)", label: "rgba(20, 18, 16, 0.62)", balance: "rgba(20, 18, 16, 0.55)", placeholder: "rgba(20, 18, 16, 0.25)",
  addBorder: "rgba(20, 18, 16, 0.12)", add: "rgba(20, 18, 16, 0.62)",
  levBorder: "rgba(20, 18, 16, 0.12)", lev: "rgba(20, 18, 16, 0.62)", levOnBorder: "rgba(20, 18, 16, 0.12)", levOnBg: "rgba(217, 62, 31, 0.08)", levOnInk: "rgba(20, 18, 16, 0.62)",
  cellRule: "rgba(20, 18, 16, 0.08)", liveRule: "rgba(217, 62, 31, 0.3)", readLabel: "rgba(20, 18, 16, 0.62)", readValue: "rgba(20, 18, 16, 0.8)",
  caption: "rgba(20, 18, 16, 0.55)", chance: "rgba(20, 18, 16, 0.7)",
  gateBorder: "rgba(20, 18, 16, 0.1)", gateBg: "rgba(20, 18, 16, 0.02)", warnBorder: "rgba(217, 62, 31, 0.25)", warnBg: "rgba(217, 62, 31, 0.04)",
  gateBody: "#5E574B", gateLine: "#7C7466", gateQuiet: "rgba(20, 18, 16, 0.45)", onVermilion: "#FFFFFF",
  ppBorder: "rgba(20, 18, 16, 0.12)", pp: "rgba(20, 18, 16, 0.55)", ppOnBg: "rgba(20, 18, 16, 0.06)", ppOnInk: "#141210", ppOff: "rgba(20, 18, 16, 0.3)",
  foot: "rgba(20, 18, 16, 0.4)",
  privBorder: "rgba(217, 62, 31, 0.25)", privBg: "rgba(217, 62, 31, 0.05)", privText: "rgba(20, 18, 16, 0.7)",
  ctaSideInk: "#141210", blockedBg: "#ECE3D2", blockedInk: "#9A9080", hairline: "rgba(20, 18, 16, 0.12)",
  noteBg: "#ECE3D2",
  switchOff: "rgba(20, 18, 16, 0.12)", switchThumb: "#F4EEE3",
};

export type TicketTokens = typeof DARK;
export const ticketTokens = (name: ThemeName): TicketTokens => (name === "dark" ? DARK : LIGHT);
