import { MIRROR_WITHIN_MIN_SEC, type AgentPosture, type MirrorSpec, type PresetKey, type StrategySpec } from "@agari/core/strategies";
import { STRATEGIES } from "./copy";

/** What the studio holds while a creator builds: every preset's knobs at once, so switching presets loses nothing. */
export interface StudioDraft {
  preset: PresetKey;
  lookback: number;
  thresholdPct: string;
  persona: string;
  posture: AgentPosture;
  cadences: number[];
  hosting: "house" | "self";
  /** A-3b: the wallet a "Copy a trader" strategy follows, and how fresh one of its calls has to be. */
  trader: string;
  mirrorWithinSec: number;
  agent: string;
  name: string;
  portraitSeed: string;
  maxPerTrade: string;
  maxDaily: string;
  subFee: string;
  playbook: string;
}

export function initialStudioDraft(houseRunner: string | null): StudioDraft {
  return { preset: "agent", lookback: 6, thresholdPct: "0.2", persona: STRATEGIES.studio.agent.defaultPersona, posture: "balanced", cadences: [900, 3600], hosting: houseRunner ? "house" : "self", trader: "", mirrorWithinSec: MIRROR_WITHIN_MIN_SEC * 4, agent: "", name: "", portraitSeed: "agari-new-agent", maxPerTrade: "1", maxDaily: "5", subFee: "0", playbook: "" };
}

export function studioReadKey(form: StudioDraft): string {
  return JSON.stringify({ spec: draftSpec(form), maxPerTrade: form.maxPerTrade, maxDaily: form.maxDaily, runner: form.hosting === "house" ? "house" : form.agent, hosting: form.hosting });
}

/** The spec the draft would publish — the only thing hashed on-chain. */
export function draftSpec(form: StudioDraft): StrategySpec {
  if (form.preset === "agent") return { preset: "agent", persona: form.persona.trim(), posture: form.posture, cadences: [...form.cadences].sort((a, b) => a - b) };
  if (form.preset === "mirror") return { preset: "mirror", trader: form.trader.trim() as MirrorSpec["trader"], withinSec: form.mirrorWithinSec };
  return { preset: form.preset, lookback: form.lookback, thresholdBps: Math.round((parseFloat(form.thresholdPct) || 0) * 100) };
}
