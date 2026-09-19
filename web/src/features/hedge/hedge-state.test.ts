import { describe, expect, it } from "vitest";
import { err, ok, diagnosis } from "@agari/core";
import { hedgeCardState } from "./hedge-state";
import type { HedgePick } from "./hedge-target";
import type { HoldingView } from "./useHoldings";

const holding: HoldingView = { mint: "m", symbol: "OPENAI", issuer: "prestocks", underlying: "OPENAI", sharesE8: 420_000_000n, exposureUsdE6: null, priceAgeSec: null };
const pick = { underlying: "OPENAI" } as unknown as HedgePick;

describe("hedgeCardState", () => {
  it("names every state the card can be in, in priority order", () => {
    expect(hedgeCardState({ address: null, holdings: null, pick: null, clockReady: true }).kind).toBe("no-wallet");
    expect(hedgeCardState({ address: "a", holdings: null, pick: null, clockReady: true }).kind).toBe("reading");
    expect(hedgeCardState({ address: "a", holdings: ok([holding], 1), pick: null, clockReady: false }).kind).toBe("reading");
    expect(hedgeCardState({ address: "a", holdings: err(diagnosis("unknown", "x")), pick: null, clockReady: true }).kind).toBe("unreadable");
    expect(hedgeCardState({ address: "a", holdings: ok([], 1), pick: null, clockReady: true }).kind).toBe("no-holding");
    expect(hedgeCardState({ address: "a", holdings: ok([holding], 1), pick: null, clockReady: true })).toEqual({ kind: "no-window", lead: holding });
    expect(hedgeCardState({ address: "a", holdings: ok([holding], 1), pick, clockReady: true })).toEqual({ kind: "offer", pick });
  });
});
