import type { ThemeName } from "../../index";
import { DARK as DARK_PALETTE, LIGHT as LIGHT_PALETTE, type Palette } from "../../palette";

/**
 * web's desk cockpit, record and decision (cockpit.css, activity.css, decision.css, desk.css, desk-kit.css) as the
 * browser computes them at 402 px on useagari.xyz. Nearly every value is a palette role; the rest are CSS
 * `color-mix(in srgb, …)` over those roles, which React Native lacks, so they are mixed here the way the browser mixes
 * them (premultiplied alpha): e.g. `.act-check[data-tone="acted"]` reads color(srgb … / 0.415) on the dark hairline.
 */
type Rgba = [number, number, number, number];

function parse(color: string): Rgba {
  if (color === "transparent") return [0, 0, 0, 0];
  if (color.startsWith("#")) {
    const n = Number.parseInt(color.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const parts = color.replace(/^rgba?\(/, "").replace(/\)$/, "").split(",").map((p) => Number(p.trim()));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

/** `color-mix(in srgb, a share, b)`: `share` of `a` (0–1) over `b`, both "#rrggbb", "rgba(…)" or "transparent". */
export function cmix(a: string, b: string, share: number): string {
  const [ar, ag, ab, aa] = parse(a);
  const [br, bg, bb, ba] = parse(b);
  const alpha = share * aa + (1 - share) * ba;
  if (alpha <= 0) return "rgba(0, 0, 0, 0)";
  const ch = (x: number, y: number) => Math.round((share * aa * x + (1 - share) * ba * y) / alpha);
  return `rgba(${ch(ar, br)}, ${ch(ag, bg)}, ${ch(ab, bb)}, ${Number(alpha.toFixed(4))})`;
}

/** `share` of a colour over nothing: web's `color-mix(in srgb, X p%, transparent)`. */
export const fade = (color: string, share: number): string => cmix(color, "transparent", share);

function tokens(c: Palette) {
  return {
    /** `.dkit-status[data-tone]` borders: live/warn/stopped mix their ink 40% with transparent. */
    statusLive: fade(c.profit, 0.4),
    statusWarn: fade(c.warning, 0.4),
    statusStopped: fade(c.loss, 0.4),
    /** `.act-badge` washes. */
    badgeActed: fade(c.profit, 0.12),
    badgeAsked: fade(c.warning, 0.14),
    badgeLoss: fade(c.loss, 0.12),
    /** `.act-check[data-tone]` borders: the tone over the hairline. */
    checkActed: cmix(c.profit, c.hairline, 0.35),
    checkAsked: cmix(c.warning, c.hairline, 0.45),
    /** `.cp-needs` border. */
    needsBorder: cmix(c.warning, c.hairline, 0.45),
    /** `.cp-chip[data-tone]` borders. */
    chipIn: fade(c.profit, 0.4),
    chipWarn: fade(c.warning, 0.4),
    /** `.cp-flag` and `.dc-blocker` wash. */
    warnWash: fade(c.warning, 0.1),
    /** `.cp-rule[data-by="program"]` border. */
    ruleProgram: cmix(c.accent, c.hairline, 0.35),
    /** `.cp-action[data-tone="danger"]` border. */
    actionDanger: fade(c.loss, 0.45),
    /** `.cp-usdc` disc: USDC blue 18%. */
    usdcWash: fade(c.markUsdc, 0.18),
    /** `.cp-head-disc` glow. */
    headGlow: fade(c.accent, 0.14),
    /** `.dkit-spark-area` when flat. */
    sparkFlat: fade(c.inkSecondary, 0.12),
    /** `.dc-strip-track` gradient ends. */
    stripFrom: fade(c.inkMuted, 0.22),
    stripTo: fade(c.inkMuted, 0.38),
    /** `.dc-check` refused wash, `.dc-badge` ok/bad borders. */
    checkBad: fade(c.loss, 0.08),
    badgeOk: fade(c.profit, 0.5),
    badgeBad: fade(c.loss, 0.5),
    /** `.dk-control[data-tone="primary"]` ink: `--color-cream-ink`, in both themes. */
    controlPrimaryInk: c.creamInk,
    /** `.dkit-slider-thumb` and `.cp-menu` shadow (rgb(0 0 0 / .35)). */
    shadow: fade(c.shadow, 0.35),
    clear: "transparent",
  };
}

const DARK = tokens(DARK_PALETTE);
const LIGHT: typeof DARK = tokens(LIGHT_PALETTE);

export type DeskCockpitTokens = typeof DARK;
export const deskCockpitTokens = (name: ThemeName): DeskCockpitTokens => (name === "dark" ? DARK : LIGHT);
