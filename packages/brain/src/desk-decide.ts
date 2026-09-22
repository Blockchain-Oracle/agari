/**
 * The desk's one model call (S21, desk.md §8): WHEN, never WHAT. One structured read against core's strict
 * `deskTimingSchema`, under the desk's own deadline, then core's checks over the answer (cited ids exist, the part
 * size matches, no hard banned word, no quotation of the owner's private notes). A failure of any kind is an answer
 * with no decision, and the desk does nothing that hour: it fails closed. The provider switch stays `resolveModel()`;
 * `DESK_AI_MODEL` names a model for the desk alone, ahead of `AI_MODEL`.
 */
import { checkDeskTiming, DESK_TIMING_PROMPT_VERSION, DESK_TIMING_SYSTEM_PROMPT, deskTimingSchema, quotesPrivateText, styleWordsUsed, type DeskTiming, type DeskTimingAnswer } from "@agari/core/desk";
import { APICallError, generateObject, NoObjectGeneratedError, type LanguageModel } from "ai";
import { modelLabel } from "./agent-read";
import { missingCredentialHint, resolveModel, type ResolvedModel } from "./model";

export const DEFAULT_DESK_TIMEOUT_MS = 45_000;
/** The answer is a dozen short fields; the budget covers the model's reasoning on top. */
const MAX_OUTPUT_TOKENS = 2048;
/** A timing call weighs seven evidence items against ten rules once an hour: worth more thought than a Window read, well inside 45 s. */
const REASONING = "medium" as const;
const MAX_RETRIES = 1;

export type DeskReadFailure = "timeout" | "parse" | "refusal" | "upstream";

export interface DeskTimingMeta {
  /** `provider/<id the provider reported>`; never a key. */
  modelId: string;
  latencyMs: number;
  totalTokens: number | null;
  finishReason: string | null;
}

export type DeskTimingRead = { ok: true; decision: DeskTiming; meta: DeskTimingMeta } | { ok: false; failure: DeskReadFailure; detail: string; meta: DeskTimingMeta };

export interface ReadDeskTimingInput {
  system: string;
  user: string;
  model: LanguageModel;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

/** The desk's model: `DESK_AI_MODEL` when set, else `AI_MODEL`, else the default, on whichever credential exists. */
export function resolveDeskModel(env: NodeJS.ProcessEnv = process.env): ResolvedModel | null {
  return resolveModel(env.DESK_AI_MODEL, env);
}

export function missingDeskCredentialHint(env: NodeJS.ProcessEnv = process.env): string {
  return missingCredentialHint(env.DESK_AI_MODEL, env);
}

class ReadTimeout extends Error {
  override readonly name = "TimeoutError";
}

function classify(error: unknown, timeoutMs: number): { failure: DeskReadFailure; detail: string } {
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return { failure: "timeout", detail: `no answer within ${timeoutMs} ms` };
  if (NoObjectGeneratedError.isInstance(error)) {
    if (error.finishReason === "content-filter") return { failure: "refusal", detail: "the model declined to answer" };
    return { failure: "parse", detail: `the answer was not a timing decision${error.finishReason ? ` (finished: ${error.finishReason})` : ""}` };
  }
  if (APICallError.isInstance(error)) return { failure: "upstream", detail: error.statusCode ? `provider answered ${error.statusCode}` : error.message };
  return { failure: "upstream", detail: error instanceof Error ? error.message : String(error) };
}

/**
 * The deadline is the desk's own: the signal is passed down so a well-behaved transport stops early, and the race
 * guarantees the hold even when one does not. The caller's own signal (a process shutting down) aborts too.
 */
async function withDeadline<T>(timeoutMs: number, outer: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const onOuter = () => controller.abort();
  outer?.addEventListener("abort", onOuter, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ReadTimeout(`no answer within ${timeoutMs} ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([run(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuter);
  }
}

/** One structured read: the model answers the strict timing schema or the read fails closed. */
export async function readDeskTiming({ system, user, model, timeoutMs = DEFAULT_DESK_TIMEOUT_MS, abortSignal }: ReadDeskTimingInput): Promise<DeskTimingRead> {
  const label = modelLabel(model);
  const provider = label.slice(0, label.indexOf("/"));
  const startedMs = Date.now();
  try {
    const result = await withDeadline(timeoutMs, abortSignal, (signal) =>
      generateObject({ model, schema: deskTimingSchema, system, prompt: user, reasoning: REASONING, maxOutputTokens: MAX_OUTPUT_TOKENS, maxRetries: MAX_RETRIES, abortSignal: signal }),
    );
    const answered = result.response.modelId;
    return {
      ok: true,
      decision: result.object,
      meta: { modelId: answered && provider ? `${provider}/${answered}` : label, latencyMs: Date.now() - startedMs, totalTokens: result.usage.totalTokens ?? null, finishReason: result.finishReason ?? null },
    };
  } catch (error) {
    return { ok: false, ...classify(error, timeoutMs), meta: { modelId: label, latencyMs: Date.now() - startedMs, totalTokens: null, finishReason: null } };
  }
}

export interface DecideDeskTimingInput {
  model: LanguageModel;
  /** The byte-stable system prompt; the current version unless a caller replays an old one. */
  system?: string;
  promptVersion?: string;
  user: string;
  /** The ids the model was shown and may cite. */
  evidenceIds: readonly string[];
  ruleIds: readonly string[];
  /** The owner's rules in their own words: an answer that quotes them is refused (the record is public). */
  privateTexts: readonly string[];
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

/**
 * The read plus our own checks, as the record stores it (`DeskTimingAnswer`): the provider's raw answer stays in the
 * record whether or not it passed, `problems` says why it did not, and `decision` is present only when it did.
 */
export async function decideDeskTiming(i: DecideDeskTimingInput): Promise<DeskTimingAnswer> {
  const read = await readDeskTiming({ system: i.system ?? DESK_TIMING_SYSTEM_PROMPT, user: i.user, model: i.model, ...(i.timeoutMs === undefined ? {} : { timeoutMs: i.timeoutMs }), ...(i.abortSignal ? { abortSignal: i.abortSignal } : {}) });
  const base = { promptVersion: i.promptVersion ?? DESK_TIMING_PROMPT_VERSION, model: read.meta.modelId, latencyMs: read.meta.latencyMs, totalTokens: read.meta.totalTokens, finishReason: read.meta.finishReason };
  if (!read.ok) return { ...base, error: `${read.failure}: ${read.detail}`, problems: [], styleWords: [], raw: null, decision: undefined };
  const problems = checkDeskTiming(read.decision, i.evidenceIds, i.ruleIds);
  if (quotesPrivateText(read.decision, i.privateTexts)) problems.push("quotes the owner's private notes");
  return { ...base, error: null, problems, styleWords: styleWordsUsed(read.decision), raw: read.decision, decision: problems.length === 0 ? read.decision : undefined };
}
