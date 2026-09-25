import type { OutcomeColumn } from "@agari/core/desk";
import { TICKERS, type PreIpoSymbol } from "@agari/core/market";
import { Ban, Check, CircleDashed, Hand, OctagonAlert, type LucideIcon } from "lucide-react-native";
import type { Palette } from "~/theme";

/**
 * The desk's tones, as web's desk kit colours them (desk-kit.css, activity.css): a verdict's ink, its wash and its
 * icon; plus the brand colour mix web writes as `color-mix(… 78%, var(--color-ink))`, computed here because React
 * Native has no color-mix().
 */
export type NodeTone = "acted" | "declined" | "quiet" | "asked" | "stopped" | "error" | "neutral";

/** web/src/features/desk/activity/check-groups.ts `TONE`. */
export const TONE: Record<OutcomeColumn, NodeTone> = {
  acted: "acted",
  acted_in_part: "acted",
  acted_by_override: "acted",
  would_have_acted: "acted",
  asked: "asked",
  declined: "declined",
  nothing_to_do: "quiet",
  waited: "quiet",
  not_executed: "error",
  blocked_by_limit: "stopped",
  failed: "error",
};

export function toneInk(tone: NodeTone, color: Palette): string {
  switch (tone) {
    case "acted":
      return color.profit;
    case "declined":
      return color.accent;
    case "asked":
      return color.warning;
    case "stopped":
    case "error":
      return color.loss;
    default:
      return color.inkMuted;
  }
}

export function toneWash(tone: NodeTone, color: Palette): string {
  switch (tone) {
    case "acted":
      return color.profitWash;
    case "declined":
      return color.accentWash;
    case "stopped":
    case "error":
      return color.lossWash;
    default:
      return color.surface2;
  }
}

/** web's ActivityTimeline `ICON`: the lucide mark each verdict carries. */
export const TONE_LUCIDE: Record<NodeTone, LucideIcon> = {
  acted: Check,
  declined: Ban,
  quiet: CircleDashed,
  asked: Hand,
  stopped: OctagonAlert,
  error: OctagonAlert,
  neutral: CircleDashed,
};


function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `share` of `a` over `b`, both "#rrggbb"; the result is a hex string. */
export function mixHex(a: string, b: string, share: number): string {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  const part = (x: number, y: number) => Math.round(x * share + y * (1 - share)).toString(16).padStart(2, "0");
  return `#${part(ar, br)}${part(ag, bg)}${part(ab, bb)}`;
}

/** web's `segColor`: a company's brand colour pulled toward the ink, so the darkest marks still read on the page. */
export function segColor(symbol: string, color: Palette): string {
  const hex = TICKERS[symbol as PreIpoSymbol]?.brand.hex;
  return hex ? mixHex(hex, color.ink, 0.78) : color.inkSecondary;
}

/** web's cockpit `brandColor`: the registry's own brand hex, unmixed; the secondary ink for anything unknown. */
export function brandColor(symbol: string, color: Palette): string {
  return TICKERS[symbol as PreIpoSymbol]?.brand.hex ?? color.inkSecondary;
}
