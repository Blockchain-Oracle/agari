import type { ThemeName } from "../index";

/**
 * web's `/activity`, `/claim` and first-run Tutorial colours as the browser computes them at 402 px, per theme:
 * news.css / activity.css's `--news-*` ladder and gray steps, yosuku's `.btn-primary` pill, x.css and tutorial.css.
 */
/** tutorial.css + the card's utilities (bg-neutral-900/95, border-white/10, the gray ladder part-14 and tutorial.css remap on cream). */
const TUTORIAL_DARK = {
  tutScrim: "rgba(0, 0, 0, 0.7)", tutCard: "rgba(23, 23, 23, 0.95)", tutBorder: "rgba(255, 255, 255, 0.09)", tutInk: "#FFFFFF",
  tutBody: "#A3A3A3", tutNote: "#737373", tutFine: "#525252", tutDotPast: "rgba(255, 255, 255, 0.2)", tutDotAhead: "rgba(255, 255, 255, 0.08)",
  tutBoxBorder: "rgba(255, 255, 255, 0.08)", tutBoxFill: "rgba(255, 255, 255, 0.02)",
};
const TUTORIAL_LIGHT: typeof TUTORIAL_DARK = {
  tutScrim: "rgba(0, 0, 0, 0.7)", tutCard: "rgba(251, 247, 238, 0.94)", tutBorder: "rgba(20, 18, 16, 0.11)", tutInk: "#141210",
  tutBody: "rgba(20, 18, 16, 0.8)", tutNote: "rgba(20, 18, 16, 0.62)", tutFine: "rgba(20, 18, 16, 0.5)", tutDotPast: "rgba(20, 18, 16, 0.16)", tutDotAhead: "rgba(20, 18, 16, 0.08)",
  tutBoxBorder: "rgba(20, 18, 16, 0.08)", tutBoxFill: "rgba(20, 18, 16, 0.02)",
};

const DARK = {
  // .act-list --news-*
  newsHairline: "rgba(255, 255, 255, 0.12)", newsRule: "rgba(255, 255, 255, 0.06)", newsHover: "rgba(255, 255, 255, 0.02)",
  // the yosuku gray ladder where it is not a theme role: gray-200 (row titles), gray-600 (meta), gray-700 (arrow)
  gray200: "#E5E5E5", gray600: "#525252", gray700: "#404040",
  // .btn.btn-primary: vermilion pill, ink inherits the page's white in dark
  pillFill: "#E04D26", pillInk: "#FFFFFF",
  // x-card.css `.xc`: the 12% ink hairline, the page washes, the profit slab and the white X pill on the ground
  xcLine: "rgba(255, 255, 255, 0.12)", washV: "rgba(224, 77, 38, 0.13)", washG: "rgba(52, 211, 153, 0.08)",
  slabFill: "rgba(52, 211, 153, 0.1)", slabBorder: "rgba(52, 211, 153, 0.45)", ctaInk: "#FBF7EE",
  // `.xr`: the cream ticket, fixed in both themes
  xrPaper: "#FBF7EF", xrV: "#E04D26", xrInk: "#141210", xrMute: "#6E6353", xrGreen: "#2E6B4F", xrFaint: "#9A8E7B",
  xrPill: "rgba(20, 18, 16, 0.06)", xrPillKnown: "rgba(46, 107, 79, 0.12)", xrHr: "rgba(20, 18, 16, 0.1)", xrShadow: "rgb(40, 28, 18)",
  // tutorial.css
  ...TUTORIAL_DARK,
};

const LIGHT: typeof DARK = {
  newsHairline: "rgba(20, 18, 16, 0.12)", newsRule: "rgba(20, 18, 16, 0.08)", newsHover: "rgba(20, 18, 16, 0.03)",
  gray200: "#2E2821", gray600: "#9A9080", gray700: "#C4BAA6",
  pillFill: "#D93E1F", pillInk: "#FBF7EE",
  xcLine: "rgba(20, 18, 16, 0.12)", washV: "rgba(217, 62, 31, 0.13)", washG: "rgba(46, 107, 79, 0.08)",
  slabFill: "rgba(46, 107, 79, 0.1)", slabBorder: "rgba(46, 107, 79, 0.45)", ctaInk: "#FBF7EE",
  xrPaper: "#FBF7EF", xrV: "#E04D26", xrInk: "#141210", xrMute: "#6E6353", xrGreen: "#2E6B4F", xrFaint: "#9A8E7B",
  xrPill: "rgba(20, 18, 16, 0.06)", xrPillKnown: "rgba(46, 107, 79, 0.12)", xrHr: "rgba(20, 18, 16, 0.1)", xrShadow: "rgb(40, 28, 18)",
  ...TUTORIAL_LIGHT,
};

export type ActivityTokens = typeof DARK;
export const activityTokens = (name: ThemeName): ActivityTokens => (name === "dark" ? DARK : LIGHT);
