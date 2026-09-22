import { describe, expect, it } from "vitest";
import { assetPairUnit, assetPriceLine, assetPriceParts, assetSpotLine, pointsLine } from "../hero/units";
import { priceSourceLine } from "./lane-view";

const window = (asset: "TSLA" | "OPENAI" | "AILABS", lane: "regular" | "token") => ({ asset, lane, tradingStartSec: 1_790_000_000, expirySec: 1_790_003_600 }) as const;

describe("priceSourceLine (S19: the source is the asset's kind, not the lane)", () => {
  it("names Switchboard only for an xStock, the PreStocks read for a pre-IPO name, and the index for a basket", () => {
    expect(priceSourceLine(window("TSLA", "token"))).toContain("Switchboard TSLAx");
    const openai = priceSourceLine(window("OPENAI", "token"));
    expect(openai).toContain("PreStocks OpenAI token price");
    expect(openai).not.toContain("Switchboard");
    const ailabs = priceSourceLine(window("AILABS", "token"));
    expect(ailabs).toContain("AI Labs index, in points");
    expect(ailabs).toContain("OpenAI, Anthropic");
    expect(ailabs).not.toContain("Switchboard");
    expect(priceSourceLine(window("TSLA", "regular"))).not.toContain("Switchboard");
  });
});

describe("the basket unit (S19: points, never dollars)", () => {
  it("formats a basket's figures in points and everything else in dollars", () => {
    expect(pointsLine(100_420_000_000n)).toBe("1,004.20 pts");
    expect(assetPriceLine("AILABS", 100_420_000_000n)).toBe("1,004.20 pts");
    expect(assetPriceLine("AILABS", 42_000_000n, 100_000_000_000n)).toBe("0.42 pts");
    expect(assetPriceLine("OPENAI", 112_738_444_694n)).toBe("$1,127.38");
    expect(assetSpotLine("PREALL", 99_995_000_000n)).toBe("999.95 pts");
    expect(assetSpotLine("TSLA", 36_547_600_000n)).toBe("$365.47");
    expect(assetPriceParts("AILABS", 100_000_000_000n)).toEqual({ sign: "", figure: "1,000.00 pts" });
    expect(assetPriceParts("TSLA", 36_547_600_000n)).toEqual({ sign: "$", figure: "365.47" });
    expect(assetPairUnit("AILABS")).toBe("index");
    expect(assetPairUnit("TSLAx")).toBe("USD");
  });
});
