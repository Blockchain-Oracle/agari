import { describe, expect, it, vi } from "vitest";
import { confBpsOf, createPythEntitlementStore, describeEntitlements, isPythIndexFeed, PROBE_EVERY_MS, PROBE_RETRY_MS, pythIndexFeeds, refusalReason } from "./pyth-entitlement";

const OPENAI = "96d4bb23a3db78fdb72b3a03ce80ead686096f324319166534d9a27c0519c483";
const ANTHROPIC = "5da511a7c68b17a3bc94380cab4756bc83ab87f86307af10ea58467a64b6689d";
const TSLA = "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1";
const DENIED_BODY = 'Unauthorized: requires access to one of the following groups: ["pyth-indices"]';
const T = 1_790_000_000;

const answer = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, text: async () => (typeof body === "string" ? body : JSON.stringify(body)), json: async () => body });
const parsed = (id: string, price: string, conf: string, publish: number, prev: number | null) => ({ parsed: [{ id, price: { price, conf, expo: -5, publish_time: publish }, metadata: { prev_publish_time: prev } }] });

describe("the registry's valuation indices", () => {
  it("names the two indices by their pre-IPO name and tells them from a trial feed", () => {
    expect(pythIndexFeeds()).toEqual([{ symbol: "OPENAI", feedIdHex: OPENAI }, { symbol: "ANTHROPIC", feedIdHex: ANTHROPIC }]);
    expect(isPythIndexFeed(OPENAI)).toBe(true);
    expect(isPythIndexFeed(`0x${OPENAI.toUpperCase()}`)).toBe(true);
    expect(isPythIndexFeed(TSLA)).toBe(false);
  });
  it("reads the group Hermes names, and the conf in bps", () => {
    expect(refusalReason(DENIED_BODY)).toBe("pyth-indices");
    expect(refusalReason("Forbidden")).toBe("Forbidden");
    expect(confBpsOf(50_000_000_000n, 60_000_000n)).toBe(12);
    expect(confBpsOf(0n, 1n)).toBeNull();
  });
});

describe("pyth-entitlement store", () => {
  it("records a 403 as denied with the group, and the feed stays unusable while every other Pyth feed stays usable", async () => {
    const fetch = vi.fn(async () => answer(403, DENIED_BODY));
    const log = vi.fn();
    const store = createPythEntitlementStore({ key: "k", log, fetch: fetch as never });
    expect(store.state(OPENAI)).toBe("unknown");
    expect(store.usable(OPENAI)).toBe(false);
    expect(store.usable(TSLA)).toBe(true);
    const row = await store.probe(OPENAI, T * 1000);
    expect(row).toMatchObject({ symbol: "OPENAI", state: "denied", status: 403, reason: "pyth-indices", checkedAtSec: T, lastError: null });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${OPENAI}&parsed=true`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(store.usable(OPENAI)).toBe(false);
    expect(store.usable(TSLA)).toBe(true);
    expect(store.entitled()).toEqual([]);
    expect(log).toHaveBeenCalledWith("pyth-entitlement: OPENAI denied (403 pyth-indices)");
    expect(describeEntitlements(store)).toBe("OPENAI denied (403 pyth-indices) · ANTHROPIC unknown");
    // The hour has to pass before OPENAI is asked again; ANTHROPIC, never probed, is due now.
    expect(store.due(T * 1000 + 1).map((f) => f.symbol)).toEqual(["ANTHROPIC"]);
    expect(store.due(T * 1000 + PROBE_EVERY_MS).map((f) => f.symbol)).toEqual(["OPENAI", "ANTHROPIC"]);
  });

  it("records a 200 as entitled with the publish spacing and conf, and the lane becomes usable", async () => {
    const fetch = vi.fn(async () => answer(200, parsed(`0x${OPENAI}`, "50000000000", "60000000", T - 2, T - 3)));
    const store = createPythEntitlementStore({ key: "k", log: vi.fn(), fetch: fetch as never });
    const row = await store.probe(OPENAI, T * 1000);
    expect(row).toMatchObject({ state: "entitled", status: 200, reason: null, publishSpacingSec: 1, confBps: 12, publishTimeSec: T - 2 });
    expect(store.usable(OPENAI)).toBe(true);
    expect(store.entitled().map((f) => f.symbol)).toEqual(["OPENAI"]);
    expect(store.snapshot().OPENAI).toMatchObject({ state: "entitled", feedIdHex: OPENAI });
  });

  it("keeps the state it had through a timeout or a 5xx, and retries sooner than the hour", async () => {
    let mode: "ok" | "boom" | "500" = "ok";
    const fetch = vi.fn(async () => {
      if (mode === "boom") throw new Error("fetch failed");
      if (mode === "500") return answer(502, "bad gateway");
      return answer(200, parsed(`0x${OPENAI}`, "1", "0", T, null));
    });
    const store = createPythEntitlementStore({ key: "k", log: vi.fn(), fetch: fetch as never });
    await store.probe(OPENAI, T * 1000);
    expect(store.state(OPENAI)).toBe("entitled");
    mode = "boom";
    expect(await store.probe(OPENAI, T * 1000 + 1)).toMatchObject({ state: "entitled", lastError: "fetch failed", checkedAtSec: T });
    mode = "500";
    expect(await store.probe(OPENAI, T * 1000 + 2)).toMatchObject({ state: "entitled", lastError: "Hermes HTTP 502" });
    expect(store.due(T * 1000 + 2 + PROBE_RETRY_MS - 1).map((f) => f.symbol)).toEqual(["ANTHROPIC"]);
    expect(store.due(T * 1000 + 2 + PROBE_RETRY_MS).map((f) => f.symbol)).toEqual(["OPENAI", "ANTHROPIC"]);
  });

  it("without a key probes nothing and every feed stays unknown", async () => {
    const fetch = vi.fn();
    const store = createPythEntitlementStore({ key: undefined, log: vi.fn(), fetch: fetch as never });
    expect(store.hasKey).toBe(false);
    expect(store.due()).toEqual([]);
    expect(await store.probe(OPENAI)).toMatchObject({ state: "unknown", reason: "no PYTH_API_KEY" });
    expect(fetch).not.toHaveBeenCalled();
    expect(describeEntitlements(store)).toBe("OPENAI unknown (no PYTH_API_KEY) · ANTHROPIC unknown (no PYTH_API_KEY)");
  });

  it("lets a consumer that met a refusal on the feed alone mark it denied", () => {
    const store = createPythEntitlementStore({ key: "k", log: vi.fn(), fetch: vi.fn() as never });
    store.markDenied(ANTHROPIC, 403, "pyth-indices");
    expect(store.feed(ANTHROPIC)).toMatchObject({ state: "denied", status: 403, reason: "pyth-indices" });
    expect(store.usable(ANTHROPIC)).toBe(false);
  });
});
