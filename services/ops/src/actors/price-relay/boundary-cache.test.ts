import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The fetch modules pull in the prints barrel, which does not load here; the cache's own rules are what is under test.
vi.mock("./hermes-fetch", () => ({ fetchPythAt: vi.fn() }));
vi.mock("./redstone-fetch", () => ({ feedAt: vi.fn(), fetchRedstoneAt: vi.fn() }));

const { fetchPythAt } = await import("./hermes-fetch");
const { BoundaryCache } = await import("./boundary-cache");
const { createPythEntitlementStore } = await import("../../runtime/pyth-entitlement");
import type { RelaySources } from "./sources";

const OPENAI = "96d4bb23a3db78fdb72b3a03ce80ead686096f324319166534d9a27c0519c483";
const TSLA = "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1";
const T = 1_790_000_000;
const sources: RelaySources = { redstoneFeeds: [], pythFeeds: [{ symbol: "TSLA", feedIdHex: TSLA }], redstoneSigners: new Set(), redstoneSignerCount: 5, redstoneThreshold: 3, gateways: [], pythTrialLastSec: T + 86_400 };
const fetchMock = vi.mocked(fetchPythAt);

describe("BoundaryCache and the valuation indices (S20)", () => {
  // Hermes pacing holds a second between requests: the clock is stepped past it between calls.
  beforeEach(() => vi.useFakeTimers({ now: T * 1000 }));
  afterEach(() => vi.useRealTimers());
  const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

  it("refuses an unentitled index before any request leaves, and the trial latch stays down", async () => {
    fetchMock.mockReset();
    const store = createPythEntitlementStore({ key: "k", log: vi.fn(), fetch: vi.fn() as never });
    const cache = new BoundaryCache(sources, "k", store);
    expect(await cache.pyth(T, [OPENAI])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.pythRefusal(T, [OPENAI])).toBe("OPENAI index not entitled");
    expect(cache.pythAuthFailed).toBe(false);
    store.markDenied(OPENAI, 403, "pyth-indices");
    expect(await cache.pyth(T, [OPENAI])).toBeNull();
    expect(cache.pythRefusal(T, [OPENAI])).toBe("OPENAI index not entitled (403 pyth-indices)");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.pythAuthFailed).toBe(false);
  });

  it("without a store treats every index as unentitled", async () => {
    fetchMock.mockReset();
    const cache = new BoundaryCache(sources, "k");
    expect(await cache.pyth(T, [OPENAI])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never asks for an index and a trial feed in one request", async () => {
    fetchMock.mockReset();
    const store = createPythEntitlementStore({ key: "k", log: vi.fn(), fetch: vi.fn() as never });
    store.markDenied(OPENAI, 200 as never); // any state: the mix is refused first
    const cache = new BoundaryCache(sources, "k", store);
    expect(await cache.pyth(T, [TSLA, OPENAI])).toBeNull();
    expect(cache.pythRefusal(T, [TSLA, OPENAI])).toContain("never fetched in the same request");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a 403 on an entitled index becomes that feed's denial, not the key's latch; a 403 on a trial feed still latches", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 403, authFailed: true });
    const store = createPythEntitlementStore({ key: "k", log: vi.fn(), fetch: vi.fn(async () => ({ status: 200, ok: true, text: async () => "", json: async () => ({ parsed: [{ id: OPENAI, price: { price: "1", conf: "0", expo: -5, publish_time: T }, metadata: {} }] }) })) as never });
    await store.probe(OPENAI);
    expect(store.state(OPENAI)).toBe("entitled");
    const cache = new BoundaryCache(sources, "k", store);
    expect(await cache.pyth(T, [OPENAI])).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.state(OPENAI)).toBe("denied");
    expect(store.feed(OPENAI)?.status).toBe(403);
    expect(cache.pythAuthFailed).toBe(false);
    // The trial path is unchanged: a refusal there is the key dying, and every later Pyth fetch stops.
    later(3_000);
    expect(await cache.pyth(T + 300, [TSLA])).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.pythAuthFailed).toBe(true);
    later(3_000);
    fetchMock.mockClear();
    expect(await cache.pyth(T + 600, [TSLA])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
