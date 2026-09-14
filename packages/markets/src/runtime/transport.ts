/**
 * The browser and server JSON-RPC transport for reads and user sends (first-call.md §1). Kit's default HTTP transport
 * (fetch, no undici: this file is in every client bundle) behind a per-endpoint token bucket, 4 RPS for every call and
 * 1 TPS more for `sendTransaction`, so one tab can never burst through the public endpoint's per-IP limit. 429 and
 * gateway errors are retried up to 3 tries in all, waiting the server's `Retry-After` when it is readable (a browser
 * sees it only when the endpoint exposes it through CORS) and a jittered backoff otherwise.
 */
import { createDefaultRpcTransport, isSolanaError, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, type RpcTransport } from "@solana/kit";

const MAX_RPS = 4;
const SEND_TPS = 1;
const MAX_TRIES = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 10_000;
const RETRY_STATUS: ReadonlySet<number> = new Set([429, 502, 503, 504]);

type Take = (signal?: AbortSignal) => Promise<void>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

/** A token bucket: `take` resolves when a token is free, in arrival order; an aborted waiter gives up its place. */
function tokenBucket(ratePerSec: number): Take {
  let tokens = ratePerSec;
  let refilledMs = Date.now();
  let tail: Promise<void> = Promise.resolve();
  const refill = () => {
    const now = Date.now();
    tokens = Math.min(ratePerSec, tokens + ((now - refilledMs) / 1000) * ratePerSec);
    refilledMs = now;
  };
  return (signal) => {
    const turn = tail.then(async () => {
      for (refill(); tokens < 1; refill()) await sleep(Math.ceil(((1 - tokens) / ratePerSec) * 1000), signal);
      tokens -= 1;
    });
    tail = turn.catch(() => undefined);
    return turn;
  };
}

/** One pair of buckets per endpoint for the whole tab or process: every client of one URL shares its budget. */
const buckets = new Map<string, { anyCall: Take; sendCall: Take }>();
const calls = new Map<string, number>();

function bucketsFor(url: string) {
  let pair = buckets.get(url);
  if (!pair) buckets.set(url, (pair = { anyCall: tokenBucket(MAX_RPS), sendCall: tokenBucket(SEND_TPS) }));
  return pair;
}

const methodOf = (payload: unknown): string => {
  const method = (payload as { method?: unknown } | null)?.method;
  return typeof method === "string" ? method : "unknown";
};

/** `Retry-After` as seconds or an HTTP date; null when absent or unreadable. */
function retryAfterMs(error: unknown): number | null {
  if (!isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)) return null;
  const header = error.context.headers?.get?.("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const atMs = Date.parse(header);
  return Number.isNaN(atMs) ? null : Math.max(0, atMs - Date.now());
}

function retryable(error: unknown): boolean {
  return isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR) && RETRY_STATUS.has(error.context.statusCode);
}

/** Kit's default transport, paced per endpoint and retried on rate limits and gateway errors. */
export function pacedRpcTransport(url: string): RpcTransport {
  const { anyCall, sendCall } = bucketsFor(url);
  const inner = createDefaultRpcTransport({ url: url as Parameters<typeof createDefaultRpcTransport>[0]["url"] });
  return (async (request: Parameters<RpcTransport>[0]) => {
    const method = methodOf(request.payload);
    for (let attempt = 1; ; attempt++) {
      try {
        if (method === "sendTransaction") await sendCall(request.signal);
        await anyCall(request.signal);
        calls.set(method, (calls.get(method) ?? 0) + 1);
        return await inner(request);
      } catch (error) {
        if (attempt >= MAX_TRIES || request.signal?.aborted || !retryable(error)) throw error;
        const backoff = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
        const wait = retryAfterMs(error) ?? backoff / 2 + Math.random() * (backoff / 2);
        await sleep(Math.min(wait, MAX_DELAY_MS), request.signal);
      }
    }
  }) as RpcTransport;
}

/** HTTP JSON-RPC calls this tab or process has sent, by method (retries included): the per-tab budget, measured. */
export function rpcCallCounts(): Readonly<Record<string, number>> {
  return Object.fromEntries(calls);
}
