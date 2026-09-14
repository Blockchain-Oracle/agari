import { describe, expect, it } from "vitest";
import { feedRawToOracleRaw } from "../markets/hero/units";
import { senseiTurnContext } from "./prompt";
import { oracleToWholeUsd } from "./units";

describe("Sensei oracle dollar boundary", () => {
  it("gives the model comparable whole-dollar opening and live prices from real feed scales", () => {
    // A TSLA opening print is normalized to 10⁻⁸ on-chain ($365.48); a live tick may arrive at 18 decimals.
    const opening = oracleToWholeUsd(36_548_000_000n);
    const live = oracleToWholeUsd(feedRawToOracleRaw(365_912_345_678_901_234_567n, 18));
    expect(opening).toBe(365);
    expect(live).toBe(366);
    const context = senseiTurnContext({ messages: [], restless: false, snapshot: {
      priceUsd: { TSLA: live! },
      markets: [{ asset: "TSLA", cadence: "1h", minsToClose: 10, lineUsd: opening, upCents: 54, downCents: 48 }],
    } });
    expect(context).toContain("TSLA $366");
    expect(context).toContain("line $365");
  });

  it("preserves the snapshot's whole-dollar rounding and missing-print semantics", () => {
    expect(oracleToWholeUsd(24_949_000_000n)).toBe(249);
    expect(oracleToWholeUsd(24_950_000_000n)).toBe(250);
    expect(oracleToWholeUsd(null)).toBeNull();
  });
});
