import { describe, expect, it } from "vitest";
import { feedRawToOracleRaw } from "../markets/hero/units";
import { senseiTurnContext } from "./prompt";
import { oracleToWholeUsd } from "./units";

describe("Sensei oracle dollar boundary", () => {
  it("gives the model comparable whole-dollar opening and live prices from real feed scales", () => {
    // Shannon opening numericValue is cents; the EMA feed is 18 decimals, converted by the chart.
    const opening = oracleToWholeUsd(7_983_070n);
    const live = oracleToWholeUsd(feedRawToOracleRaw(79_921_466_704_266_065_779_969n, 18));
    expect(opening).toBe(79_831);
    expect(live).toBe(79_921);
    const context = senseiTurnContext({ messages: [], restless: false, snapshot: {
      priceUsd: { BTC: live! },
      markets: [{ asset: "BTC", cadence: "1h", minsToClose: 10, lineUsd: opening, upCents: 54, downCents: 48 }],
    } });
    expect(context).toContain("BTC $79,921");
    expect(context).toContain("line $79,831");
  });

  it("preserves the snapshot's whole-dollar rounding and missing-print semantics", () => {
    expect(oracleToWholeUsd(249_031n)).toBe(2_490);
    expect(oracleToWholeUsd(249_050n)).toBe(2_491);
    expect(oracleToWholeUsd(null)).toBeNull();
  });
});
