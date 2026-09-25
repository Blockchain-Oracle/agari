import type { Tone } from "@/features/edge/format";
import { useTheme } from "~/theme";
import { edgeTokens } from "~/theme/web/portfolio-edge";

/** The edge page's own palette for the active theme, and a tone's ink (`.is-gain` profit, `.is-loss` loss, else the page text). */
export function useEdgeInk() {
  const { name, color } = useTheme();
  const edge = edgeTokens(name);
  const toneInk = (tone: Tone | undefined) => (tone === "gain" ? color.profit : tone === "loss" ? color.loss : edge.text);
  return { edge, toneInk, profit: color.profit, loss: color.loss };
}
