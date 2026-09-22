/**
 * The one model call, under the runner's sliding-hour budget (`strategy-runner/agent.ts` `takeCall`). No brain, or
 * no budget left, is an answer with the reason named and no decision: the desk then does nothing that hour and the
 * record says exactly why. The budget is warmed from the records on boot, so a restart never doubles it.
 */
import { decideDeskTiming } from "@agari/brain";
import { DESK_TIMING_PROMPT_VERSION, type DeskEvidencePack, type DeskTimingAnswer } from "@agari/core/desk";
import type { RunnerContext } from "./types";

const HOUR_MS = 3_600_000;

export function callsThisHour(ctx: RunnerContext, nowMs: number): number {
  ctx.callsAtMs = ctx.callsAtMs.filter((at) => nowMs - at < HOUR_MS);
  return ctx.callsAtMs.length;
}

/** One call under the budget, or false: the candidate is then recorded as undecided, not read. */
export function takeCall(ctx: RunnerContext, nowMs: number): boolean {
  if (callsThisHour(ctx, nowMs) >= ctx.env.maxModelCallsPerHour) return false;
  ctx.callsAtMs.push(nowMs);
  return true;
}

/** Calls already made in the last hour, from every desk's records, so the budget survives a restart. */
export async function warmCallBudget(ctx: RunnerContext, nowMs: number): Promise<number> {
  const made = await ctx.q.modelCallsSince(Math.floor(nowMs / 1000) - HOUR_MS / 1000).catch(() => [] as number[]);
  ctx.callsAtMs = made.map((sec) => sec * 1000).filter((at) => nowMs - at < HOUR_MS);
  return ctx.callsAtMs.length;
}

function undecided(ctx: RunnerContext, error: string): DeskTimingAnswer {
  const model = ctx.brain ? `${ctx.brain.providerName}/${ctx.brain.modelId}` : "none";
  return { promptVersion: DESK_TIMING_PROMPT_VERSION, model, latencyMs: 0, totalTokens: null, finishReason: null, error, problems: [], styleWords: [], raw: null, decision: undefined };
}

/** The name the record shows for a stubbed answer, so nobody mistakes it for a model's. */
export const MODEL_STUB_NAME = "stub/DESK_MODEL_STUB";

/**
 * The fixed answer `DESK_MODEL_STUB` stands in with on localnet (the fork rehearsal, C6): shaped exactly like a
 * model's, cites the first evidence id so core's checks pass, and names itself in every field a reader would look at.
 */
function stubbed(option: "ACT_NOW" | "WAIT" | "DECLINE", pack: DeskEvidencePack): DeskTimingAnswer {
  const decision = {
    option,
    partPercent: null,
    headline: `Rehearsal stub: ${option.toLowerCase().replace("_", " ")} (DESK_MODEL_STUB on localnet, not a model's answer).`,
    confidencePercent: 100,
    reasons: [{ text: "The fork rehearsal replaces the timing answer with a fixed one so the whole live path is exercised.", evidenceIds: pack.evidenceIds.slice(0, 1) }],
    rejected: [],
    premiumRead: "unknown" as const,
    waitFor: option === "WAIT" ? "the rehearsal to say otherwise" : null,
    warnings: ["DESK_MODEL_STUB override: no model was asked"],
    ruleIds: [],
  };
  return { promptVersion: DESK_TIMING_PROMPT_VERSION, model: MODEL_STUB_NAME, latencyMs: 0, totalTokens: null, finishReason: "stub", error: null, problems: [], styleWords: [], raw: decision, decision };
}

/** The timing question for one candidate, or why it was not asked. */
export async function askTiming(ctx: RunnerContext, pack: DeskEvidencePack, privateTexts: readonly string[], nowMs: number): Promise<DeskTimingAnswer> {
  if (ctx.env.modelStub && ctx.env.cluster === "localnet") return stubbed(ctx.env.modelStub, pack);
  if (!ctx.brain) return undecided(ctx, `not configured: set ${ctx.brainMissing}`);
  if (!takeCall(ctx, nowMs)) return undecided(ctx, `call budget spent (${ctx.env.maxModelCallsPerHour} an hour); asking again next hour`);
  return decideDeskTiming({ model: ctx.brain.model, user: pack.userMessage, evidenceIds: pack.evidenceIds, ruleIds: pack.ruleIds, privateTexts, timeoutMs: ctx.env.modelTimeoutMs });
}
