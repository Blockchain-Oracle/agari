/**
 * Read-endpoint health.
 *
 * One place decides whether an endpoint is answering, and it asks the question that
 * matters. The previous probe resolved as soon as a WebSocket opened, which a dead or
 * wrong-chain node will happily do: the socket is up, every JSON-RPC request on it times
 * out, and the application concludes the endpoint is fine. Health here means a real
 * `eth_chainId` round trip completed inside the timeout.
 *
 * This is observation only. Nothing here rotates an endpoint or touches the runtime —
 * a read failover must never be able to move a signer or replay a write, so selection
 * stays an explicit call by the one caller that owns runtime construction.
 */

const PROBE_TIMEOUT_MS = 4_000;

export interface EndpointHealth {
  url: string;
  index: number;
  healthy: boolean;
  /** Round-trip time of the probe request, not of the socket handshake. */
  latencyMs: number | null;
  /** The chain the endpoint actually reports — a healthy socket on the wrong chain is not healthy. */
  chainId: number | null;
  checkedAtMs: number | null;
  consecutiveFailures: number;
}

const health = new Map<string, EndpointHealth>();

function record(url: string, index: number, result: { healthy: boolean; latencyMs: number | null; chainId: number | null }): EndpointHealth {
  const previous = health.get(url);
  const entry: EndpointHealth = {
    url,
    index,
    healthy: result.healthy,
    latencyMs: result.latencyMs,
    chainId: result.chainId,
    checkedAtMs: Date.now(),
    consecutiveFailures: result.healthy ? 0 : (previous?.consecutiveFailures ?? 0) + 1,
  };
  health.set(url, entry);
  return entry;
}

/** One `eth_chainId` round trip. Resolves unhealthy rather than rejecting — a probe is a question, not a failure. */
function probeEndpoint(url: string, timeoutMs: number): Promise<{ healthy: boolean; latencyMs: number | null; chainId: number | null }> {
  if (typeof WebSocket === "undefined") return Promise.resolve({ healthy: true, latencyMs: null, chainId: null });
  return new Promise((resolve) => {
    const startedAtMs = Date.now();
    let settled = false;
    let socket: WebSocket | null = null;

    const finish = (healthy: boolean, chainId: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // a socket that never opened may throw on close; the probe result stands
      }
      resolve({ healthy, latencyMs: healthy ? Date.now() - startedAtMs : null, chainId });
    };
    const timer = setTimeout(() => finish(false, null), timeoutMs);

    try {
      socket = new WebSocket(url);
      socket.onopen = () => socket?.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }));
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as { id?: number; result?: string; error?: unknown };
          if (payload.id !== 1) return;
          if (payload.error || typeof payload.result !== "string") return finish(false, null);
          finish(true, Number.parseInt(payload.result, 16));
        } catch {
          finish(false, null);
        }
      };
      socket.onerror = () => finish(false, null);
      socket.onclose = () => finish(false, null);
    } catch {
      finish(false, null);
    }
  });
}

/** Probes every endpoint in parallel and records what each one said. */
export async function checkEndpoints(urls: readonly string[], timeoutMs = PROBE_TIMEOUT_MS): Promise<readonly EndpointHealth[]> {
  return Promise.all(
    urls.map(async (url, index) => record(url, index, await probeEndpoint(url, timeoutMs))),
  );
}

/** Everything known so far, for the status surface. Never a render gate. */
export function endpointHealth(): readonly EndpointHealth[] {
  return [...health.values()].sort((a, b) => a.index - b.index);
}

/**
 * The index of the endpoint to read from: the healthy one with the lowest probe latency,
 * or 0 when none answered — the SDK then reports its own failure honestly rather than the
 * application inventing a reason.
 */
export async function selectReadEndpoint(urls: readonly string[], timeoutMs = PROBE_TIMEOUT_MS): Promise<number> {
  const results = await checkEndpoints(urls, timeoutMs);
  const healthy = results.filter((entry) => entry.healthy);
  if (healthy.length === 0) return 0;
  return healthy.reduce((best, entry) => ((entry.latencyMs ?? Infinity) < (best.latencyMs ?? Infinity) ? entry : best)).index;
}
