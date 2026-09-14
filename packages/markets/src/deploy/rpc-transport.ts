/**
 * The JSON-RPC transport every operator client uses (the S3 devnet soak hit Helius 429s at boundary bursts and
 * half-closed keep-alive sockets). Retries live here, above `fetch`: undici's retry interceptor can't replay a fetch
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

let dispatcher: Dispatcher | undefined;

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
export function retryingRpcTransport(url: string): RpcTransport {
  const inner = createDefaultRpcTransport({ url: url as never, dispatcher_NODE_ONLY: rpcHttpDispatcher() as never }) as RpcTransport;
  return (async (request: Parameters<RpcTransport>[0]) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await inner(request);
      } catch (error) {
        if (attempt >= MAX_RETRIES || request.signal?.aborted || !retryable(error)) throw error;
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
        await sleep(delay / 2 + Math.random() * (delay / 2), request.signal);
      }
    }
  }) as RpcTransport;
}
