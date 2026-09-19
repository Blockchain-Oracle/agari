import { describe, expect, it } from "vitest";
import { feedRawToOracleRaw } from "../markets/hero/units";
import { senseiTurnContext } from "./prompt";
import { oracleToUsd } from "./units";

describe("Sensei oracle dollar boundary", () => {
  it("gives the model comparable opening and live prices in cents below $1,000, from real feed scales", () => {
    // A TSLA opening print is normalized to 10⁻⁸ on-chain ($365.48); a live tick may arrive at 18 decimals.
    const opening = oracleToUsd(36_548_000_000n);
    const live = oracleToUsd(feedRawToOracleRaw(365_912_345_678_901_234_567n, 18));
    expect(opening).toBe(365.48);
    expect(live).toBe(365.91);
    const context = senseiTurnContext({ messages: [], restless: false, snapshot: {
      priceUsd: { TSLA: live! },
      markets: [{ asset: "TSLA", cadence: "1h", minsToClose: 10, lineUsd: opening, upCents: 54, downCents: 48 }],
    } });
    expect(context).toContain("TSLA $365.91");
    expect(context).toContain("line $365.48");
  });

  it("keeps cents on a four-digit stock, whole dollars only from $10,000 up, rounds half up, and keeps missing prints missing", () => {
    // OPENAI near $1,132.74 settles to the cent; the reference's $1,000 rule rounded it to $1,133.
    expect(oracleToUsd(113_274_000_000n)).toBe(1_132.74);
    expect(oracleToUsd(1_234_567_000_000n)).toBe(12_346);
    expect(oracleToUsd(24_949_500_000n)).toBe(249.5);
    expect(oracleToUsd(24_949_499_999n)).toBe(249.49);
    expect(oracleToUsd(null)).toBeNull();
  });
});
