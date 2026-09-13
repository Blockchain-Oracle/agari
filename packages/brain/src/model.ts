import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Which model answers as Sensei — server only.
 *
 * The first cut called the Anthropic SDK directly, which meant the provider was a
 * code change rather than a setting. This resolves a model from configuration
 * instead, through the Vercel AI SDK's uniform interface, so Claude, GPT, Gemini or
 * anything speaking the OpenAI protocol are the same call with a different string.
 *
 * One variable does it:
 *
 *   AI_MODEL="anthropic/claude-opus-5"   (the default)
 *   AI_MODEL="openai/gpt-5.4"
 *   AI_MODEL="google/gemini-3-5-flash"
 *
 * and the resolver takes whichever route the available credential allows:
 *
 *   1. AI_BASE_URL + AI_API_KEY  → any OpenAI-compatible endpoint. This is the
 *      escape hatch for OpenRouter, Together, Groq, vLLM, a local Ollama — none of
 *      which needs a package of its own, because they all speak that protocol.
 *   2. the named provider's own key (ANTHROPIC_API_KEY, OPENAI_API_KEY,
 *      GOOGLE_GENERATIVE_AI_API_KEY) → that provider directly.
 *   3. AI_GATEWAY_API_KEY → Vercel's AI Gateway, which takes the whole
 *      `creator/model` string and routes it. One key, every provider.
 *   4. nothing → `null`, and the route says so. The dock renders in full either way.
 *
 * Direct keys are tried before the gateway on purpose: a key you already hold
 * should not need a gateway account to be useful.
 *
 * **What this trades away.** The Anthropic SDK exposes things no portable interface
 * can: server-side refusal fallbacks, explicit `cache_control` breakpoints, adaptive
 * thinking's `display`. Those are gone. What survives is the part that matters here
 * — reasoning effort is a *portable* top-level parameter in AI SDK 7, so `low` means
 * low effort on Claude and on GPT alike, without a branch per provider.
 */

/** Claude stays the default. It is the best model for this job; the point is that it is now a setting. */
export const DEFAULT_AI_MODEL = "anthropic/claude-opus-5";

type Factory = (modelId: string) => LanguageModel;

interface DirectProvider {
  keyEnv: string;
  create: (apiKey: string) => Factory;
}

const DIRECT: Record<string, DirectProvider> = {
  anthropic: { keyEnv: "ANTHROPIC_API_KEY", create: (apiKey) => createAnthropic({ apiKey }) },
  openai: { keyEnv: "OPENAI_API_KEY", create: (apiKey) => createOpenAI({ apiKey }) },
  google: { keyEnv: "GOOGLE_GENERATIVE_AI_API_KEY", create: (apiKey) => createGoogleGenerativeAI({ apiKey }) },
};

export interface ResolvedModel {
  model: LanguageModel;
  /** How the model was reached, for the logs and the health probe. Never a key. */
  via: "custom-endpoint" | "direct" | "gateway";
  providerName: string;
  modelId: string;
}

/** Splits `creator/model` once, so a model id containing further slashes survives. */
function split(spec: string): { providerName: string; modelId: string } {
  const at = spec.indexOf("/");
  return at === -1 ? { providerName: "", modelId: spec } : { providerName: spec.slice(0, at), modelId: spec.slice(at + 1) };
}

export function resolveModel(): ResolvedModel | null {
  const spec = process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;
  const { providerName, modelId } = split(spec);

  const baseURL = process.env.AI_BASE_URL?.trim();
  const customKey = process.env.AI_API_KEY?.trim();
  if (baseURL && customKey) {
    // Anything OpenAI-shaped. The model id is passed whole — these endpoints expect
    // their own naming, which is rarely `creator/model`.
    return { model: createOpenAI({ apiKey: customKey, baseURL })(spec), via: "custom-endpoint", providerName: providerName || "custom", modelId: spec };
  }

  const direct = DIRECT[providerName];
  const directKey = direct ? process.env[direct.keyEnv]?.trim() : undefined;
  if (direct && directKey) {
    return { model: direct.create(directKey)(modelId), via: "direct", providerName, modelId };
  }

  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    // A bare `creator/model` string is a valid LanguageModel: the SDK routes it
    // through the Gateway as the default global provider.
    return { model: spec, via: "gateway", providerName, modelId };
  }

  return null;
}

/** What is missing, said precisely enough to fix without reading the code. */
export function missingCredentialHint(): string {
  const spec = process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;
  const { providerName } = split(spec);
  const direct = DIRECT[providerName];
  return direct ? `${direct.keyEnv} (for ${spec}), or AI_GATEWAY_API_KEY` : `AI_GATEWAY_API_KEY (for ${spec}), or AI_BASE_URL + AI_API_KEY`;
}
