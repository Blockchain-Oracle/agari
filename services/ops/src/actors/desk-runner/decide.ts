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

/** The timing question for one candidate, or why it was not asked. */
export async function askTiming(ctx: RunnerContext, pack: DeskEvidencePack, privateTexts: readonly string[], nowMs: number): Promise<DeskTimingAnswer> {
  if (!ctx.brain) return undecided(ctx, `not configured: set ${ctx.brainMissing}`);
  if (!takeCall(ctx, nowMs)) return undecided(ctx, `call budget spent (${ctx.env.maxModelCallsPerHour} an hour); asking again next hour`);
  return decideDeskTiming({ model: ctx.brain.model, user: pack.userMessage, evidenceIds: pack.evidenceIds, ruleIds: pack.ruleIds, privateTexts, timeoutMs: ctx.env.modelTimeoutMs });
}
