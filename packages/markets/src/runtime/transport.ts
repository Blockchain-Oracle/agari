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

type Request = Parameters<RpcTransport>[0];
type Send = (request: Request) => Promise<unknown>;

/** Kit's default transport, paced per endpoint and retried on rate limits and gateway errors. */
function pacedSend(url: string): Send {
  const { anyCall, sendCall } = bucketsFor(url);
  const inner = createDefaultRpcTransport({ url: url as Parameters<typeof createDefaultRpcTransport>[0]["url"] });
  return async (request) => {
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
  };
}

interface InfoCall {
  id: unknown;
  address: string;
  resolve: (response: unknown) => void;
  reject: (error: unknown) => void;
}

/** `getMultipleAccounts` takes at most this many addresses. */
const MULTIPLE_ACCOUNTS_MAX = 100;
const configKey = (config: unknown) => JSON.stringify(config ?? {}, (_, value) => (typeof value === "bigint" ? value.toString() : value));

/**
 * Every `getAccountInfo` sent in the same turn with the same config becomes one `getMultipleAccounts`, answered back
 * to each caller in `getAccountInfo`'s own shape (the RPC returns each entry exactly as `getAccountInfo`'s `value`).
 * `loadAccount` batches our own reads; this catches the generated clients' `fetchMaybe…` reads, which call
 * `getAccountInfo` one account at a time and, behind the 4 RPS bucket, queued a page load for seconds (09-24: twelve
 * single calls on /portfolio, 250 ms apart).
 */
function coalescedAccountInfo(send: Send): (request: Request) => Promise<unknown> {
  const batches = new Map<string, { config: unknown; calls: InfoCall[] }>();
  let scheduled = false;

  const settle = async (config: unknown, group: InfoCall[]) => {
    const addresses = [...new Set(group.map((call) => call.address))];
    const payload = { jsonrpc: "2.0", id: `batch-${group[0]!.id as string}`, method: "getMultipleAccounts", params: [addresses, ...(config === undefined ? [] : [config])] };
    try {
      const response = (await send({ payload })) as { error?: unknown; result?: { context: unknown; value: unknown[] } };
      for (const call of group) {
        if (response.error !== undefined || !response.result) call.resolve({ jsonrpc: "2.0", id: call.id, error: response.error });
        else call.resolve({ jsonrpc: "2.0", id: call.id, result: { context: response.result.context, value: response.result.value[addresses.indexOf(call.address)] ?? null } });
      }
    } catch (error) {
      for (const call of group) call.reject(error);
    }
  };

  const flush = () => {
    scheduled = false;
    const pending = [...batches.values()];
    batches.clear();
    for (const { config, calls: group } of pending) {
      for (let i = 0; i < group.length; i += MULTIPLE_ACCOUNTS_MAX) void settle(config, group.slice(i, i + MULTIPLE_ACCOUNTS_MAX));
    }
  };

  return (request) => {
    const { id, params } = request.payload as { id: unknown; params: [string, unknown?] };
    const [address, config] = params;
    return new Promise((resolve, reject) => {
      const key = configKey(config);
      let batch = batches.get(key);
      if (!batch) batches.set(key, (batch = { config, calls: [] }));
      batch.calls.push({ id, address, resolve, reject });
      request.signal?.addEventListener("abort", () => reject(request.signal?.reason), { once: true });
      if (scheduled) return;
      scheduled = true;
      setTimeout(flush, 0);
    });
  };
}

/** The paced transport, with same-turn `getAccountInfo` calls coalesced into one `getMultipleAccounts`. */
export function pacedRpcTransport(url: string): RpcTransport {
  const send = pacedSend(url);
  const accountInfo = coalescedAccountInfo(send);
  return ((request: Request) => (methodOf(request.payload) === "getAccountInfo" ? accountInfo(request) : send(request))) as RpcTransport;
}

/** HTTP JSON-RPC calls this tab or process has sent, by method (retries included): the per-tab budget, measured. */
export function rpcCallCounts(): Readonly<Record<string, number>> {
  return Object.fromEntries(calls);
}
