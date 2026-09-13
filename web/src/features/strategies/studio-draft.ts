import type { AgentPosture, PresetKey, StrategySpec } from "@masayume/core/strategies";
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
  agent: string;
  name: string;
  portraitSeed: string;
  maxPerTrade: string;
  maxDaily: string;
  subFee: string;
  playbook: string;
}

export function initialStudioDraft(houseRunner: string | null): StudioDraft {
  return { preset: "agent", lookback: 6, thresholdPct: "0.2", persona: STRATEGIES.studio.agent.defaultPersona, posture: "balanced", cadences: [900, 3600], hosting: houseRunner ? "house" : "self", agent: "", name: "", portraitSeed: "masayume-new-agent", maxPerTrade: "1", maxDaily: "5", subFee: "0", playbook: "" };
}

export function studioReadKey(form: StudioDraft): string {
  return JSON.stringify({ spec: draftSpec(form), maxPerTrade: form.maxPerTrade, maxDaily: form.maxDaily, runner: form.hosting === "house" ? "house" : form.agent, hosting: form.hosting });
}

/** The spec the draft would publish — the only thing hashed on-chain. */
export function draftSpec(form: StudioDraft): StrategySpec {
  if (form.preset === "agent") return { preset: "agent", persona: form.persona.trim(), posture: form.posture, cadences: [...form.cadences].sort((a, b) => a - b) };
  return { preset: form.preset, lookback: form.lookback, thresholdBps: Math.round((parseFloat(form.thresholdPct) || 0) * 100) };
}
