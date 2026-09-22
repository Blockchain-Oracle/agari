import { NextResponse } from "next/server";

/**
 * `POST /api/rpc/mainnet` — the desk's Solana endpoint, same-origin (D-121's pattern, D-126).
 *
 * The app's read runtime stays on devnet (bets, cover, Trading Balance). The desk is real money on mainnet, so its
 * owner calls (`createDeskMainnetSession`, `rpcUrl: "/api/rpc/mainnet"`) and its browser reads (the money sheet's
 * balances, "Check it") come here, and this route spends the server's Helius mainnet key on them. The key never
 * reaches the page. The allowlist is what those two paths call and nothing more; a public proxy to a paid provider
 * is somebody else's budget, so `getProgramAccounts` and the like are not served.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
/** The desk's traffic is a few reads a minute per open page plus the odd write; four a second leaves the key to `/api/holdings` and the routes. */
const PACE_RPS = 4;
const MAX_WAIT_MS = 1_500;
let nextSlotMs = 0;

function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlotMs);
  if (at - now > MAX_WAIT_MS) return Promise.reject(new Error("paced"));
  nextSlotMs = at + 1_000 / PACE_RPS;
  return at === now ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, at - now));
}
const MAX_BODY_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 20_000;

/** The owner session's writes and confirms, the balance and state reads, and the one read "Check it" makes (`getTransaction`). */
const ALLOWED = new Set([
  "getAccountInfo",
  "getFeeForMessage",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getSignatureStatuses",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "isBlockhashValid",
  "sendTransaction",
  "simulateTransaction",
]);

/** Always mainnet: `SOLANA_MAINNET_RPC_URL` overrides, otherwise the server's Helius key. Without either, an honest 503. */
function upstream(): string | null {
  const explicit = process.env.SOLANA_MAINNET_RPC_URL;
  if (explicit) return explicit;
  const key = process.env.HELIUS_API_KEY;
  return key ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}` : null;
}

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
  const target = upstream();
  if (!target) return NextResponse.json({ error: "mainnet RPC is not configured on this deployment" }, { status: 503, headers: NO_STORE });
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
  if (refused) return NextResponse.json({ error: `method not served here: ${refused}` }, { status: 403, headers: NO_STORE });

  try {
    await paced();
  } catch {
    return NextResponse.json({ error: "too many requests" }, { status: 429, headers: { ...NO_STORE, "retry-after": "1" } });
  }

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: { ...NO_STORE, "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    // Never the error text: the upstream URL carries the key, and fetch failures quote the URL.
    return NextResponse.json({ error: "the mainnet RPC endpoint did not answer" }, { status: 502, headers: NO_STORE });
  }
}
