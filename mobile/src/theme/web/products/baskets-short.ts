import type { ThemeName } from "../../index";

/**
 * `/baskets` and `/short` as the browser computes them at 402 px (useagari.xyz, per theme): baskets.css, the desk
 * kit's status chip and logo stack, short-page.css, short-picker.css, market-session.css and shell.css's
 * capability-pending. Only the values the app palette has no role for live here; the rest read `useTheme().color`.
 */
const DARK = {
  /** .dkit-status[data-tone="live"]: the profit ink at 40%. */
  liveChipBorder: "rgba(52, 211, 153, 0.4)",
  /** .bk-action[data-kind="cover"]: loss 55% into the hairline. */
  coverBorder: "rgba(251, 124, 142, 0.6)",
  /** .sh-eyebrow: vermilion at 80%. */
  eyebrow: "rgba(224, 77, 38, 0.8)",
  /** .section-head's rule (both themes compute the dark value). */
  sectionRule: "rgba(255, 255, 255, 0.08)",
  /** .sh-picker / .sh-ticket shell. */
  panelBg: "#171717",
  panelBorder: "rgba(255, 255, 255, 0.1)",
  panelShadow: "none",
  /** .sh-filter[aria-pressed] lift. */
  filterShadow: "0px 1px 4px 0px rgba(0, 0, 0, 0.18)",
  /** .sh-window, dashed while it opens later; the chosen one keeps its accent border in dark only. */
  windowBorder: "rgba(255, 255, 255, 0.1)",
  windowOnBorder: "#E04D26",
  /** .sh-field */
  fieldBorder: "rgba(255, 255, 255, 0.1)",
  fieldFocus: "rgba(255, 255, 255, 0.25)",
  fieldBg: "transparent",
  /** .sh-multiple and its chosen state (vermilion 55% / 13%). */
  multipleBorder: "rgba(255, 255, 255, 0.1)",
  multipleOnBorder: "rgba(224, 77, 38, 0.55)",
  multipleOnBg: "rgba(224, 77, 38, 0.13)",
  /** .sh-readout's top rule. */
  readoutRule: "rgba(255, 255, 255, 0.08)",
  /** --color-warning (.sh-note--warn, .sh-line--close, the unpriced title). */
  warn: "#F2994A",
  /** .sh-empty */
  emptyBorder: "rgba(255, 255, 255, 0.08)",
  emptyBg: "transparent",
  /** .sh-pos */
  posBorder: "rgba(255, 255, 255, 0.1)",
  posBg: "#171717",
  /** .sh-how-card */
  howBorder: "rgba(255, 255, 255, 0.1)",
  howBg: "#171717",
  /** .mks-chip-dot: closed, pre/post (--gray-300), holiday (vermilion 55%). */
  sessionDotLit: "#D4D4D4",
  sessionDotHoliday: "rgba(224, 77, 38, 0.55)",
  /** .capability-pending .cp-meta rule. */
  pendingRule: "rgba(255, 255, 255, 0.08)",
  /** .sh-chip-row's mask fades the last 18% to the panel under it. */
  rowFadeFrom: "rgba(23, 23, 23, 0)",
  rowFadeTo: "#171717",
  /** .sh-chip[aria-checked]'s wash fades to nothing at 80%: the accent at 0 so the fade never greys. */
  chipWashEnd: "rgba(224, 77, 38, 0)",
};

const LIGHT: typeof DARK = {
  liveChipBorder: "rgba(46, 107, 79, 0.4)",
  coverBorder: "rgba(178, 53, 30, 0.6)",
  eyebrow: "rgba(217, 62, 31, 0.8)",
  sectionRule: "rgba(255, 255, 255, 0.08)",
  panelBg: "rgba(20, 18, 16, 0.016)",
  panelBorder: "rgba(20, 18, 16, 0.1)",
  panelShadow: "0px 20px 44px -32px rgba(20, 18, 16, 0.16)",
  filterShadow: "0px 1px 4px 0px rgba(0, 0, 0, 0.18)",
  windowBorder: "rgba(20, 18, 16, 0.14)",
  windowOnBorder: "rgba(20, 18, 16, 0.14)",
  fieldBorder: "rgba(20, 18, 16, 0.16)",
  fieldFocus: "rgba(217, 62, 31, 0.5)",
  fieldBg: "rgba(255, 255, 255, 0.45)",
  multipleBorder: "rgba(20, 18, 16, 0.14)",
  multipleOnBorder: "rgba(20, 18, 16, 0.14)",
  multipleOnBg: "rgba(217, 62, 31, 0.13)",
  readoutRule: "rgba(20, 18, 16, 0.08)",
  warn: "#A85A12",
  emptyBorder: "rgba(20, 18, 16, 0.1)",
  emptyBg: "rgba(251, 247, 238, 0.94)",
  posBorder: "rgba(20, 18, 16, 0.1)",
  posBg: "rgba(251, 247, 238, 0.94)",
  howBorder: "rgba(20, 18, 16, 0.11)",
  howBg: "rgba(251, 247, 238, 0.94)",
  sessionDotLit: "#453E33",
  sessionDotHoliday: "rgba(217, 62, 31, 0.55)",
  pendingRule: "rgba(20, 18, 16, 0.12)",
  rowFadeFrom: "rgba(240, 235, 224, 0)",
  rowFadeTo: "#F0EBE0",
  chipWashEnd: "rgba(217, 62, 31, 0)",
};

export type BasketsShortTokens = typeof DARK;
export const basketsShortTokens = (name: ThemeName): BasketsShortTokens => (name === "dark" ? DARK : LIGHT);
