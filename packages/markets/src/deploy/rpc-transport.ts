/**
 * The JSON-RPC transport every operator client uses (the S3 devnet soak hit Helius 429s at boundary bursts and
 * half-closed keep-alive sockets). Calls are paced process-wide (`RPC_MAX_RPS`, default 8; `sendTransaction` also
 * `RPC_SEND_TPS`, default 3), then retried on what still fails. Retries live here, above `fetch`: undici's retry interceptor can't replay a fetch
 * POST body (it fails with UND_ERR_REQ_CONTENT_LENGTH_MISMATCH), while a transport call rebuilds the request each time.
 * Retrying `sendTransaction` is safe: a duplicate signature is deduplicated by the cluster, and actors reconcile from
 * chain state before acting again.
 */
import { createDefaultRpcTransport, isSolanaError, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, type RpcTransport } from "@solana/kit";
import { Agent, type Dispatcher } from "undici";

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 8_000;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_NETWORK = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);

/** Process-wide pacing, so a boundary burst queues instead of hitting the provider limit (Helius devnet ≈ 10 RPS). */
const MAX_RPS = Number(process.env.RPC_MAX_RPS) || 8;
const SEND_TPS = Number(process.env.RPC_SEND_TPS) || 3;
/**
 * The share of both rates reserved for the `priority` lane (price-relay: RedStone check prints must land by T + 120,
 * and they lost the race to settler and maker traffic at busy boundaries). The two lanes together stay at the caps.
 */
const PRIORITY_RPS = Number(process.env.RPC_PRIORITY_RPS) || 3;
const PRIORITY_TPS = Number(process.env.RPC_PRIORITY_TPS) || 1;

/** `priority` gets its own reserved buckets; `normal` shares the rest. */
export type RpcLane = "priority" | "normal";

let dispatcher: Dispatcher | undefined;

/** A token bucket: `take` resolves when a token is free, in arrival order. */
function tokenBucket(ratePerSec: number) {
  let tokens = ratePerSec;
  let refilledMs = Date.now();
  let tail: Promise<void> = Promise.resolve();
  const refill = () => {
    const now = Date.now();
    tokens = Math.min(ratePerSec, tokens + ((now - refilledMs) / 1000) * ratePerSec);
    refilledMs = now;
  };
  return (signal?: AbortSignal): Promise<void> => {
    const turn = tail.then(async () => {
      for (refill(); tokens < 1; refill()) await sleep(Math.ceil(((1 - tokens) / ratePerSec) * 1000), signal);
      tokens -= 1;
    });
    tail = turn.catch(() => undefined);
    return turn;
  };
}

const BUCKETS: Record<RpcLane, { anyCall: ReturnType<typeof tokenBucket>; sendCall: ReturnType<typeof tokenBucket> }> = {
  priority: { anyCall: tokenBucket(PRIORITY_RPS), sendCall: tokenBucket(PRIORITY_TPS) },
  normal: { anyCall: tokenBucket(Math.max(1, MAX_RPS - PRIORITY_RPS)), sendCall: tokenBucket(Math.max(1, SEND_TPS - PRIORITY_TPS)) },
};
const isSend = (payload: unknown) => (payload as { method?: unknown } | null)?.method === "sendTransaction";

/** Bounded connections per origin, header/body timeouts, and a keep-alive shorter than the provider's idle close. */
export function rpcHttpDispatcher(): Dispatcher {
  dispatcher ??= new Agent({ connections: 16, headersTimeout: 30_000, bodyTimeout: 30_000, keepAliveTimeout: 4_000 });
  return dispatcher;
}

function retryable(error: unknown): boolean {
  if (isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)) return RETRY_STATUS.has(error.context.statusCode);
  for (let e: unknown = error, depth = 0; e && depth < 6; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && RETRY_NETWORK.has(code)) return true;
  }
  return error instanceof TypeError && error.message === "fetch failed";
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

/** The default Kit HTTP transport over the shared dispatcher, retried with jittered exponential backoff. */
export function retryingRpcTransport(url: string, lane: RpcLane = "normal"): RpcTransport {
  const { anyCall, sendCall } = BUCKETS[lane];
  const inner = createDefaultRpcTransport({ url: url as never, dispatcher_NODE_ONLY: rpcHttpDispatcher() as never }) as RpcTransport;
  return (async (request: Parameters<RpcTransport>[0]) => {
    for (let attempt = 0; ; attempt++) {
      try {
        if (isSend(request.payload)) await sendCall(request.signal);
        await anyCall(request.signal);
        return await inner(request);
      } catch (error) {
        if (attempt >= MAX_RETRIES || request.signal?.aborted || !retryable(error)) throw error;
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
        await sleep(delay / 2 + Math.random() * (delay / 2), request.signal);
      }
    }
  }) as RpcTransport;
}
