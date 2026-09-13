import type { EventMarket } from "@masayume/core/types";
import { agentPrompt, EMPTY_AGENT_RECORD, moveBps } from "@masayume/core/strategies";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ opening: vi.fn(), price: vi.fn(), history: vi.fn(), quote: vi.fn() }));
vi.mock("../provider", () => ({ marketsProvider: { getOpeningPrice: mocks.opening, getAssetPrice: mocks.price, getPriceHistory: mocks.history, freshQuoteStake: mocks.quote } }));
import { readAgentContext } from "./agent-context";

const ok = <T>(value: T) => ({ ok: true as const, value, stale: false, asOfMs: 1_300_000 });
const market = { marketId: `0x${"11".repeat(32)}`, asset: "BTC", intervalSec: 900, tradingStartSec: 1_000, expirySec: 1_900, decimals: 6 } as EventMarket;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.opening.mockResolvedValue(ok(10_000n));
  mocks.price.mockResolvedValue(ok({ emaRaw: 10_020n, priceRaw: 10_020n, decimals: 2 }));
  mocks.history.mockResolvedValue(ok([]));
  mocks.quote.mockResolvedValue(ok({ oddsCents: 50 }));
});

describe("fresh agent context", () => {
  it("normalizes oracle cents into the 18dp feed for the actual AI prompt and movement", async () => {
    // $62,150.00 oracle opening and $62,162.43 feed EMA: +2 bps, not a 10^16 price jump.
    mocks.opening.mockResolvedValue(ok(6_215_000n));
    mocks.price.mockResolvedValue(ok({ emaRaw: 62_162_430_000_000_000_000_000n, priceRaw: 62_162_430_000_000_000_000_000n, decimals: 18 }));
    const reading = await readAgentContext(market, 100n, 1_300_000);
    expect(reading.ok).toBe(true);
    if (!reading.ok) throw new Error("context did not read");
    expect(reading.value.openingRaw).toBe(62_150_000_000_000_000_000_000n);
    expect(moveBps(reading.value.openingRaw, reading.value.emaRaw)).toBe(2);
    const prompt = agentPrompt({ preset: "agent", persona: "Follow the trend", posture: "balanced", cadences: [900] }, reading.value, EMPTY_AGENT_RECORD);
    expect(prompt.user).toContain("Opening print: 62,150.00");
    expect(prompt.user).toContain("EMA 62,162.43 (+2 bps from the print)");
  });
  it("refuses invalid declared feed scales before constructing an AI prompt", async () => {
    mocks.price.mockResolvedValue(ok({ emaRaw: 10_020n, priceRaw: 10_020n, decimals: 1 }));
    expect((await readAgentContext(market, 100n, 1_300_000)).ok).toBe(false);
  });
  it("does not re-label a stale opening, price or history as fresh model context", async () => {
    for (const [read, value] of [[mocks.opening, 10_000n], [mocks.price, { emaRaw: 10_020n, priceRaw: 10_020n, decimals: 2 }], [mocks.history, []]] as const) {
      read.mockResolvedValueOnce({ ...ok(value), stale: true });
      expect((await readAgentContext(market, 100n, 1_300_000)).ok).toBe(false);
    }
  });
  it("leaves stale side quotes unavailable to the gate", async () => {
    mocks.quote.mockResolvedValue({ ...ok({ oddsCents: 50 }), stale: true });
    const reading = await readAgentContext(market, 100n, 1_300_000);
    expect(reading).toMatchObject({ ok: true, stale: false, value: { upCents: null, downCents: null } });
  });
});
