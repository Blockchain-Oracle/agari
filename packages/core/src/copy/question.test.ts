import { describe, expect, it } from "vitest";
import { plainQuestion, wordQuestion } from "./question";

describe("questions name the level in the asset's unit (S23)", () => {
  it("a basket is asked in points, a stock in dollars", () => {
    const basket = wordQuestion({ marketId: "m1", asset: "AILABS", intervalSec: 3_600, openingPriceRaw: 105_602_000_000n }, 8, "4:00 AM");
    const stock = wordQuestion({ marketId: "m1", asset: "TSLA", intervalSec: 300, openingPriceRaw: 37_862_000_000n }, 8, "4:00 AM");
    expect(basket.text).toContain("1,056.02 pts");
    expect(basket.text).not.toContain("$");
    expect(stock.text).toContain("$378.62");
    expect(plainQuestion({ asset: "PREALL", intervalSec: 3_600, openingPriceRaw: 100_360_000_000n }, 8).text).toContain("1,003.60 pts?");
  });
});
