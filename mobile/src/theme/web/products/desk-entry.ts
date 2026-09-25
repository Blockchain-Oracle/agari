import { TICKERS, type PreIpoSymbol } from "@agari/core/market";
import type { ThemeName } from "../../index";

/**
 * web's `/desk` entry and `/desk/new` studio as the browser computes them at 402 px (useagari.xyz, per theme):
 * entry.css, studio.css and desk.css values the app palette has no role for. Everything that already equals a
 * `useTheme().color` role is read from there instead.
 */
const DARK = {
  /** .st-chip border and ink, off and on (yosuku part-03's light rule overrides border and ink in both states). */
  chipBorder: "rgba(255, 255, 255, 0.1)",
  chipInk: "#A3A3A3",
  chipInkOn: "#FFFFFF",
  /** .st-icon-tile[data-level="loose"]: color-mix(warning 14%, transparent). */
  looseWash: "rgba(242, 153, 74, 0.14)",
  /** .st-created-badge ring: color-mix(profit 8%, transparent). */
  createdRing: "rgba(52, 211, 153, 0.08)",
  /** .st-stream[data-state="done"] border: color-mix(profit 40%, hairline). */
  streamDone: "rgba(78, 217, 166, 0.46)",
  /** transparent: a gradient's fading stop and the weight rows' resting border. */
  clear: "transparent",
};

const LIGHT: typeof DARK = {
  chipBorder: "rgba(20, 18, 16, 0.16)",
  chipInk: "#171310",
  chipInkOn: "#171310",
  looseWash: "rgba(242, 153, 74, 0.14)",
  createdRing: "rgba(46, 107, 79, 0.08)",
  streamDone: "rgba(42, 93, 69, 0.47)",
  clear: "transparent",
};

export type DeskEntryTokens = typeof DARK;
export const deskEntryTokens = (name: ThemeName): DeskEntryTokens => (name === "dark" ? DARK : LIGHT);

// web's studio-model `segColor`: `color-mix(in oklab, <brand> 78%, var(--color-ink))`, mixed in OKLab exactly as the
// browser does (the dump reads oklab(0.5157 0.0357 -0.1202) for OpenAI on the dark ink), then back to sRGB hex.
type Lab = [number, number, number];
const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklab(hex: string): Lab {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  const r = toLinear(((n >> 16) & 255) / 255);
  const g = toLinear(((n >> 8) & 255) / 255);
  const b = toLinear((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function toHex([L, A, B]: Lab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, fromLinear(c))) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** A company's brand colour pulled 22% toward the page ink in OKLab; `ink` is the theme's `color.ink` hex. */
export function deskSegColor(symbol: string, ink: string): string | null {
  const hex = TICKERS[symbol as PreIpoSymbol]?.brand.hex;
  if (!hex) return null;
  const a = oklab(hex);
  const b = oklab(ink);
  return toHex([a[0] * 0.78 + b[0] * 0.22, a[1] * 0.78 + b[1] * 0.22, a[2] * 0.78 + b[2] * 0.22]);
}
