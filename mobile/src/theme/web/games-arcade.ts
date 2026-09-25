import type { ThemeName } from "../index";

/**
 * web's arcade pair as the browser computes it at 402 px (arcade.css, stage.css `.crt-screen`), per theme. The
 * screen is the one dark island under /games: its ground and ink are the dark theme's whatever the page wears,
 * so those are fixed; the bezel's vignette, the board's rules and tags and the calm checkbox follow the theme.
 */
const ISLAND = {
  // `.ar-screen` triplets: rgb(var(--ar-ink-rgb) / a) and the overlay's ground at 90 %
  overlay: "rgba(5, 5, 5, 0.9)",
  ink40: "rgba(255, 255, 255, 0.4)", ink55: "rgba(255, 255, 255, 0.55)", ink60: "rgba(255, 255, 255, 0.6)",
  ink70: "rgba(255, 255, 255, 0.7)", ink85: "rgba(255, 255, 255, 0.85)",
  screw: "rgba(255, 255, 255, 0.18)",
  // `.crt-screen`: the glass gleam, the scanlines (under `mix-blend-mode: overlay`, drawn here at the strength
  // they read with) and the flicker veil
  gleam: "rgba(255, 255, 255, 0.06)", scanline: "rgba(0, 0, 0, 0.14)", flicker: "rgba(18, 16, 16, 0.12)",
};

const DARK = {
  ...ISLAND,
  vignetteNear: "rgba(0, 0, 0, 0.55)", vignetteFar: "rgba(0, 0, 0, 0.35)",
  rowRule: "rgba(255, 255, 255, 0.06)", tagBorder: "rgba(255, 255, 255, 0.14)",
  // the native checkbox under `color-scheme: dark`, `accent-color: vermilion`
  boxBorder: "#858585", boxFill: "#3B3B3B", boxTick: "#FFFFFF",
};

const LIGHT: typeof DARK = {
  ...ISLAND,
  vignetteNear: "rgba(20, 18, 16, 0.25)", vignetteFar: "rgba(20, 18, 16, 0.12)",
  rowRule: "rgba(20, 18, 16, 0.08)", tagBorder: "rgba(20, 18, 16, 0.14)",
  boxBorder: "#767676", boxFill: "#FFFFFF", boxTick: "#FFFFFF",
};

export type ArcadeTokens = typeof DARK;
export const arcadeTokens = (name: ThemeName): ArcadeTokens => (name === "dark" ? DARK : LIGHT);
