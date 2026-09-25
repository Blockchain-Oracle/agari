import type { TextStyle } from "react-native";
import type { ThemeName } from "../index";
import { FONT } from "../type";

/**
 * web's Portfolio family as the browser computes it at 402 px, per theme: the ledger plate (ledger-plate.css
 * --lp-*), the bets plate and pager (history.css), the X wallet card (x-card.css) and the shadcn button fills.
 * Everything that already equals a `useTheme().color` role is read from there instead.
 */
const DARK = {
  // ledger-plate.css: the plate follows the theme in dark (surface-1 and the theme's inks)
  lpPaper: "#171717", lpPaperRaised: "#262626", lpInk: "#FFFFFF", lpMute: "#A3A3A3", lpLine: "rgba(255, 255, 255, 0.1)",
  // fixed vermilion in both themes (.lp-figure, .lp-bar-*, .pool-action)
  vermilion: "#E04D26", barAccount: "rgba(224, 77, 38, 0.35)", actionBorder: "rgba(224, 77, 38, 0.45)", actionWash: "rgba(224, 77, 38, 0.07)",
  slabBorder: "rgba(224, 77, 38, 0.3)", earnedWash: "rgba(224, 77, 38, 0.06)", earnedIconWash: "rgba(224, 77, 38, 0.08)", earnedIconBorder: "rgba(224, 77, 38, 0.35)",
  // .connect-card: gray-500 ring glyph, gray-600 link
  ringInk: "#737373", linkInk: "#525252",
  // history.css
  rowHover: "rgba(255, 255, 255, 0.02)", markGeneric: "rgba(255, 255, 255, 0.1)", receiptInk: "rgba(255, 255, 255, 0.4)",
  equityZero: "rgba(255, 255, 255, 0.16)", equityDown: "rgba(255, 255, 255, 0.55)", equityDot: "#FFFFFF",
  equityEmptyBorder: "rgba(255, 255, 255, 0.06)", equityEmptyFill: "rgba(255, 255, 255, 0.015)", equityEmptyInk: "rgba(255, 255, 255, 0.25)",
  repBar: "rgba(255, 255, 255, 0.06)", badgeRankFill: "rgba(255, 255, 255, 0.02)", badgeLocked: "rgba(255, 255, 255, 0.018)",
  // x-card.css: its foot hairline, the slab and the verified button ink
  xFootLine: "rgba(201, 191, 166, 0.6)",
  // skeleton (bg-muted)
  skeleton: "#262626",
};

const LIGHT: typeof DARK = {
  lpPaper: "#FAF8F5", lpPaperRaised: "#FFFDF8", lpInk: "#1A1612", lpMute: "#6B6353", lpLine: "rgba(201, 191, 166, 0.4)",
  vermilion: "#E04D26", barAccount: "rgba(224, 77, 38, 0.35)", actionBorder: "rgba(224, 77, 38, 0.45)", actionWash: "rgba(224, 77, 38, 0.07)",
  slabBorder: "rgba(224, 77, 38, 0.3)", earnedWash: "rgba(224, 77, 38, 0.06)", earnedIconWash: "rgba(224, 77, 38, 0.08)", earnedIconBorder: "rgba(224, 77, 38, 0.35)",
  ringInk: "#7C7466", linkInk: "#9A9080",
  rowHover: "rgba(20, 18, 16, 0.03)", markGeneric: "rgba(20, 18, 16, 0.1)", receiptInk: "rgba(20, 18, 16, 0.62)",
  equityZero: "rgba(20, 18, 16, 0.22)", equityDown: "rgba(20, 18, 16, 0.62)", equityDot: "#141210",
  equityEmptyBorder: "rgba(20, 18, 16, 0.07)", equityEmptyFill: "rgba(20, 18, 16, 0.02)", equityEmptyInk: "rgba(20, 18, 16, 0.5)",
  repBar: "rgba(20, 18, 16, 0.08)", badgeRankFill: "rgba(20, 18, 16, 0.03)", badgeLocked: "rgba(20, 18, 16, 0.02)",
  xFootLine: "rgba(201, 191, 166, 0.6)",
  skeleton: "#ECE3D2",
};

export type PortfolioTokens = typeof DARK;
export const portfolioTokens = (name: ThemeName): PortfolioTokens => (name === "dark" ? DARK : LIGHT);

/**
 * web's type utilities (base.css + bridge.css) as they compute on the phone. `--font-data` resolves to nothing there, so
 * `type-label-micro`, `type-data*` and `.numbers` fall back to Inter; only `font-mono` rules (yosuku, the plate) are JetBrains.
 * Sora's 650 and 750 have no face in the app: 700 and 800.
 */
export const WEB_TYPE = {
  headline: { fontFamily: FONT.heading, fontSize: 26, lineHeight: 29.9, letterSpacing: -0.52 },
  title: { fontFamily: FONT.heading, fontSize: 18, lineHeight: 23.4 },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23.25 },
  bodyStrong: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 23.25 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  labelMicro: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase" },
  data: { fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 18.2, fontVariant: ["tabular-nums"] },
  dataLg: { fontFamily: FONT.bodyStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
  dataHero: { fontFamily: FONT.bodyStrong, fontSize: 36.18, lineHeight: 38, letterSpacing: -0.36, fontVariant: ["tabular-nums"] },
  numbers: { fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

/** web's `.container` / `px-gutter` inset and the page rhythm (`py-8`, `gap-8`) on Portfolio. */
export const WEB_PAGE = { gutter: 16, padY: 32, gap: 32, dock: 112 } as const;
