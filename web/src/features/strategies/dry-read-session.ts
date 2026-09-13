import { agentPreviewResponseSchema, type AgentPreviewRequest, type AgentPreviewResponse } from "./protocol";

export type DryRead = { status: "idle" } | { status: "reading" } | { status: "ok"; result: AgentPreviewResponse } | { status: "error"; error: string };

/** Owns one draft's in-flight read. Cancellation also guards providers which ignore AbortSignal. */
export function createDryReadSession(emit: (state: DryRead) => void, unreadable: string, fetcher: typeof fetch = fetch) {
  let generation = 0;
  let active: AbortController | null = null;
  const cancel = () => { generation += 1; active?.abort(); active = null; };
  return {
    cancel,
    reset: () => { cancel(); emit({ status: "idle" }); },
    read: async (request: AgentPreviewRequest) => {
      cancel();
      active = new AbortController();
      const current = generation;
      emit({ status: "reading" });
      try {
        const response = await fetcher("/api/strategies/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal: active.signal });
        const body: unknown = await response.json().catch(() => null);
        if (current !== generation) return;
        if (!response.ok) {
          const error = body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : unreadable;
          emit({ status: "error", error });
          return;
        }
        const parsed = agentPreviewResponseSchema.safeParse(body);
        emit(parsed.success ? { status: "ok", result: parsed.data } : { status: "error", error: unreadable });
      } catch {
        if (current === generation) emit({ status: "error", error: unreadable });
      }
    },
  };
}
