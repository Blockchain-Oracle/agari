import { nameOf } from "@agari/core/desk";
import type { StudioDraft } from "@/features/desk/draft";
import { chosenOf, pctLabel } from "@/features/desk/studio/studio-model";
import type { Palette } from "~/theme";
import { deskSegColor } from "~/theme/web/products/desk-entry";
import type { Slice } from "../kit";

/** web's studio-model `segColor`: the brand mixed 78% toward the ink in OKLab; the muted ink if the registry lacks it. */
export const segColor = (symbol: string, color: Palette): string => deskSegColor(symbol, color.ink) ?? color.inkMuted;

/** web's studio-model `slicesOf` in the phone's palette: each chosen company in its brand mix, then the cash. */
export function slicesOf(d: StudioDraft, color: Palette): Slice[] {
  const tokens = chosenOf(d).map((s) => ({ id: s, label: nameOf(s), value: d.weights[s] ?? 0, color: segColor(s, color) }));
  return [...tokens, { id: "cash", label: "Cash", value: d.cashBps, color: color.inkMuted }];
}

/** The screen reader's line for a mix: "OpenAI 40%, Anthropic 40%, Cash 20%". */
export const mixLabel = (slices: readonly Slice[]): string => slices.map((s) => `${s.label} ${pctLabel(s.value)}`).join(", ");
