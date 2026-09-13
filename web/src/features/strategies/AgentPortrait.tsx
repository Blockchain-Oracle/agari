import type { CSSProperties } from "react";
import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import { cn } from "@/lib/utils";
import { accentIndex } from "./names";
import "./strategies.css";

interface AgentPortraitProps {
  seed: string;
  name: string;
  size?: "small" | "row" | "card";
}

/** The reference's persona URL: `api.dicebear.com/9.x/notionists/svg?seed=…&backgroundColor=f4eee1&radius=12`. */
const PERSONA: { backgroundColor: string[]; radius: number } = { backgroundColor: ["f4eee1"], radius: 12 };
const DRAWN_CAP = 512;
const drawn = new Map<string, string>();

/** The same seed always draws the same face, so an agent is recognisable everywhere it appears. */
function persona(seed: string): string {
  const cached = drawn.get(seed);
  if (cached !== undefined) return cached;
  const svg = createAvatar(notionists, { ...PERSONA, seed }).toString();
  if (drawn.size >= DRAWN_CAP) drawn.clear();
  drawn.set(seed, svg);
  return svg;
}

/** Each agent breathes on its own beat: the phase comes from the seed, so a grid of them never bobs in unison. */
function idlePhase(seed: string): CSSProperties {
  return { "--idle-phase": `${((accentIndex(seed) * 0.45) % 3.6).toFixed(2)}s` } as CSSProperties;
}

/**
 * Per-agent portrait, identical everywhere the agent appears: the reference's DiceBear persona on its paper
 * tile, drawn here from the same MIT library instead of fetched from api.dicebear.com (which the CSP does not
 * allow). Inline SVG, so the idle and hover motion in strategies.css can move the drawing itself.
 */
export function AgentPortrait({ seed, name, size = "card" }: AgentPortraitProps) {
  return (
    <div role="img" aria-label={`${name}, agent portrait`} style={idlePhase(seed)} className={cn("strat-sigil shrink-0", `strat-sigil--${size}`, `strat-accent-${accentIndex(seed)}`)}>
      <span aria-hidden className="strat-sigil-paper" dangerouslySetInnerHTML={{ __html: persona(seed) }} />
    </div>
  );
}
