import type { ThemeName } from "../index";

/**
 * web's money dialogs as the browser computes them at 402 px, per theme: the Add-funds modal and the first-credit card
 * (features/funding/funding.css) and RainbowKit's phone sheet for connect and account (providers/wallet/wallet-modal.css).
 * The grays that equal a `useTheme().color` role (gray-400/500/600, --white) are read from there instead.
 */
const DARK = {
  // .fund-modal-scrim, .credit-scrim
  fundScrim: "rgba(0, 0, 0, 0.7)", creditScrim: "rgba(0, 0, 0, 0.6)",
  // .fund-modal: bg-[#0d0d10] border-white/10; .credit-card bg-[#0c0c0f]
  fundPaper: "#0D0D10", fundBorder: "rgba(255, 255, 255, 0.1)", creditPaper: "#0C0C0F",
  // .fund-account and .fund-foot hairlines (white/[0.06] in both themes), .fund-balances cells (white 12%)
  fundLine: "rgba(255, 255, 255, 0.06)", fundCell: "rgba(255, 255, 255, 0.12)",
  // .fund-account-addr gray-300
  addrInk: "#D4D4D4",
  // .fund-cta-white: bg-white text-black (light: #141210 on the ground)
  ctaWhite: "#FFFFFF", ctaWhiteInk: "#000000",
  // .fund-cta-vermilion: var(--vermilion), #fff
  vermilion: "#E04D26", vermilionInk: "#FFFFFF",
  // .credit-card: profit at 25% border, 10% badge fill, 30% badge ring, 80% eyebrow
  creditBorder: "rgba(52, 211, 153, 0.25)", creditBadgeFill: "rgba(52, 211, 153, 0.1)", creditBadgeRing: "rgba(52, 211, 153, 0.3)", creditEyebrow: "rgba(52, 211, 153, 0.8)",
  // .wm-feature-art
  featureArt: "#D0D5DE",
};

const LIGHT: typeof DARK = {
  fundScrim: "rgba(0, 0, 0, 0.7)", creditScrim: "rgba(0, 0, 0, 0.6)",
  fundPaper: "#F4EEE3", fundBorder: "rgba(20, 18, 16, 0.12)", creditPaper: "#F4EEE3",
  fundLine: "rgba(255, 255, 255, 0.06)", fundCell: "rgba(20, 18, 16, 0.12)",
  addrInk: "#453E33",
  ctaWhite: "#141210", ctaWhiteInk: "#F4EEE3",
  vermilion: "#D93E1F", vermilionInk: "#FFFFFF",
  creditBorder: "rgba(46, 107, 79, 0.25)", creditBadgeFill: "rgba(46, 107, 79, 0.1)", creditBadgeRing: "rgba(46, 107, 79, 0.3)", creditEyebrow: "rgba(46, 107, 79, 0.8)",
  featureArt: "#D0D5DE",
};

export type WalletTokens = typeof DARK;
export const walletTokens = (name: ThemeName): WalletTokens => (name === "dark" ? DARK : LIGHT);
