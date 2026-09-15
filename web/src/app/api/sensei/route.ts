import { APICallError, generateText, InvalidPromptError } from "ai";
import { NextResponse } from "next/server";
import { missingCredentialHint, resolveModel } from "@/features/sensei/model.server";
import { asksForAdvice, SENSEI_ERRORS, SENSEI_SYSTEM, senseiTurnContext } from "@/features/sensei/prompt";
import { type SenseiRequest, senseiRequestSchema } from "@/features/sensei/protocol";
import { clientIp, senseiGate } from "@/features/sensei/rate.server";

/**
 * Sensei's brain — ported from `reference/yosuku/app/api/sensei/route.ts`.
 *
 * Server-side only: the key never reaches the browser, which is the whole reason
 * this is a route and not a client call.
 *
 * **Provider-agnostic.** The reference hardcodes DeepSeek. This goes through the
 * Vercel AI SDK, so the model is configuration (`AI_MODEL`) rather than code —
 * Claude by default, GPT or Gemini or a local endpoint by changing one string. See
 * `model.server.ts` for how a credential is chosen.
 *
 * The reference's honest-degradation path is kept exactly: with no credential the
 * route says so, names what is missing, and the dock renders in full either way.
 *
 * No trade is placed here. Sensei reads and recommends; the user places the trade.
 *
 * S13 (spec §1.1) adds, all per turn and outside the stable prefix: the session, the reader's positions and record,
 * the advice tripwire, and a rate gate in front of the model call. The call itself stays Masayume's non-streaming
 * `generateText` (Q-S13-2).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Two to four sentences, with the model's own reasoning tokens on top of them. */
const MAX_OUTPUT_TOKENS = 4096;
/**
 * A market read is short and latency-sensitive, not a research task. Portable in
 * AI SDK 7: this is reasoning *effort*, mapped by each provider onto its own knob.
 */
const REASONING = "low" as const;

const NO_STORE = { "cache-control": "no-store" };

function bad(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/**
 * The upstream HTTP status, whichever provider produced the failure.
 *
 * Deliberately structural rather than a chain of `instanceof` checks: a layer whose
 * whole point is that the provider is swappable should not need a new branch each
 * time one is swapped in. `APICallError` from the direct providers and
 * `GatewayError` from the Gateway both carry `statusCode`.
 *
 * The name check is not redundant. A bad `AI_GATEWAY_API_KEY` is rejected *before*
 * any request goes out, so the `GatewayAuthenticationError` it throws has a name and
 * a message but no status at all — checked against the real error, not assumed. Left
 * to the status alone it read as "unreachable", which points at the network instead
 * of at the key.
 */
function statusOf(error: unknown): number | null {
  if (APICallError.isInstance(error)) return error.statusCode ?? null;
  const code = (error as { statusCode?: unknown })?.statusCode;
  if (typeof code === "number") return code;
  const name = (error as { name?: unknown })?.name;
  return typeof name === "string" && /authentication|unauthor/i.test(name) ? 401 : null;
}

export async function POST(req: Request) {
  const resolved = resolveModel();
  if (!resolved) return bad(SENSEI_ERRORS.notConfigured(missingCredentialHint()), 503);

  let body: SenseiRequest;
  try {
    const parsed = senseiRequestSchema.safeParse(await req.json());
    if (!parsed.success) return bad(SENSEI_ERRORS.badRequest, 400);
    body = parsed.data;
  } catch {
    return bad(SENSEI_ERRORS.badRequest, 400);
  }
  if (body.messages.length === 0) return bad(SENSEI_ERRORS.saySomething, 400);
  if (!senseiGate(clientIp(req), Date.now())) return bad(SENSEI_ERRORS.rateLimited, 429);

  try {
    const { text } = await generateText({
      model: resolved.model,
      system: SENSEI_SYSTEM,
      reasoning: REASONING,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      messages: [
        // The volatile per-turn figures sit in their own user turn, after the stable
        // system prompt, so a provider that caches a prefix can still do so.
        { role: "user", content: senseiTurnContext(body, { adviceAsked: asksForAdvice(body.messages) }) },
        ...body.messages.map((message) => ({ role: message.role, content: message.content })),
      ],
    });

    const reply = text.trim();
    return reply ? NextResponse.json({ reply }, { headers: NO_STORE }) : bad(SENSEI_ERRORS.wentQuiet, 502);
  } catch (error) {
    if (error instanceof InvalidPromptError) return bad(SENSEI_ERRORS.badRequest, 400);
    const status = statusOf(error);
    // 401/403 is a credential problem and not the reader's fault; say which.
    if (status === 401 || status === 403) return bad(SENSEI_ERRORS.badKey(resolved.providerName), 503);
    if (status === 429) return bad(SENSEI_ERRORS.rateLimited, 429);
    if (status !== null) return bad(SENSEI_ERRORS.upstream(status), 502);
    return bad(SENSEI_ERRORS.unreachable, 502);
  }
}
