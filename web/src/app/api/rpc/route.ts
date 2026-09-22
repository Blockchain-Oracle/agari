import { NextResponse } from "next/server";

/**
 * `POST /api/rpc` — the browser's Solana endpoint, same-origin.
 *
 * D-035 left this open: "browsers use `NEXT_PUBLIC_SOLANA_RPC_URL`, which defaults to public devnet … there is no
 * `/api/rpc` proxy in S4; revisit at S16." This is that revisit. Public devnet answers a few requests a second for
 * the whole internet, so on a hosted deployment a connected wallet's reads — the vault snapshot behind X trading,
 * the Trading Balance, a position — fail often enough that the surfaces say so: "X trading status unavailable",
 * "We could not verify your balance and trading permission."
 *
 * The key never reaches the page: it is read here and spent on the upstream request, exactly as `/api/holdings`
 * spends the mainnet one. `methods` is an allowlist rather than a deny-list, because this endpoint is public and an
 * open proxy to a paid provider is somebody else's budget. WebSockets are not proxied — a Next route handler cannot
 * — so `NEXT_PUBLIC_SOLANA_WS_URL` stays on the public endpoint, which is what the operator clients already do for
 * subscriptions (D-030).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
/**
 * One key serves ops (paced at `RPC_MAX_RPS`, D-030) and every browser through this route, and the provider answers
 * the sum with 429s: measured at the bell, four of eight `getSlot` calls through here were refused. So this process
 * takes a fixed slice — `PACE_RPS` a second, a short queue — and a caller past the queue gets a 429 of its own, which
 * the browser transport already retries with backoff. Ops keeps its share; the venue's sends come first.
 */
const PACE_RPS = 4;
const MAX_WAIT_MS = 1_500;
let nextSlotMs = 0;

/** Resolves when this call may go, or rejects at once when the queue is already longer than a browser should wait. */
function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlotMs);
  if (at - now > MAX_WAIT_MS) return Promise.reject(new Error("paced"));
  nextSlotMs = at + 1_000 / PACE_RPS;
  return at === now ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, at - now));
}
/** A `getMultipleAccounts` of a hundred addresses is a few KB; a transaction is under 2. This is room to spare. */
const MAX_BODY_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 20_000;

/** Every JSON-RPC method the browser lane actually calls, plus the three a transport uses to stay honest. */
const ALLOWED = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getEpochInfo",
  "getFeeForMessage",
  "getGenesisHash",
  "getHealth",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getRecentPrioritizationFees",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTokenSupply",
  "getTransaction",
  "getVersion",
  "isBlockhashValid",
  "sendTransaction",
  "simulateTransaction",
]);

/** The upstream endpoint. `SOLANA_RPC_URL` overrides; otherwise the server's Helius key, otherwise public devnet. */
function upstream(): string {
  const explicit = process.env.SOLANA_RPC_URL;
  if (explicit) return explicit;
  const key = process.env.HELIUS_API_KEY;
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  const host = cluster === "mainnet-beta" ? "mainnet" : "devnet";
  return key ? `https://${host}.helius-rpc.com/?api-key=${encodeURIComponent(key)}` : `https://api.${host}.solana.com`;
}

/** The methods named by a single call or a batch; null when the body is not JSON-RPC at all. */
function methodsOf(body: unknown): string[] | null {
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0) return null;
  const names: string[] = [];
  for (const call of calls) {
    if (typeof call !== "object" || call === null) return null;
    const method = (call as { method?: unknown }).method;
    if (typeof method !== "string") return null;
    names.push(method);
  }
  return names;
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "request too large" }, { status: 413, headers: NO_STORE });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "not JSON-RPC" }, { status: 400, headers: NO_STORE });
  }

  const methods = methodsOf(body);
  if (!methods) return NextResponse.json({ error: "not JSON-RPC" }, { status: 400, headers: NO_STORE });
  const refused = methods.find((name) => !ALLOWED.has(name));
  // Naming the method is safe — it came from the caller — and it is the only thing they can act on.
  if (refused) return NextResponse.json({ error: `method not served here: ${refused}` }, { status: 403, headers: NO_STORE });

  try {
    await paced();
  } catch {
    return NextResponse.json({ error: "too many requests" }, { status: 429, headers: { ...NO_STORE, "retry-after": "1" } });
  }

  try {
    const response = await fetch(upstream(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    // The upstream answer rides through untouched, status included, so a 429 still reads as a 429 to the transport's retry.
    return new NextResponse(response.body, {
      status: response.status,
      headers: { ...NO_STORE, "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    // Never the error text: the upstream URL carries the key, and fetch failures quote the URL.
    return NextResponse.json({ error: "the RPC endpoint did not answer" }, { status: 502, headers: NO_STORE });
  }
}
