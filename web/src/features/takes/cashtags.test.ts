import { describe, expect, it } from "vitest";
import { captionParts, parseCashtags } from "./cashtags";

describe("parseCashtags", () => {
  it("files a take under its Window's asset first, then registry cashtags, without repeats, at most four", () => {
    expect(parseCashtags("$NVDA and $nvda, $TSLAx, $XYZ, $NVDA again", "TSLA")).toEqual(["TSLA", "NVDA"]);
    expect(parseCashtags("$AAPL $MSFT $META $AMZN $GOOGL", "TSLA")).toEqual(["TSLA", "AAPL", "MSFT", "META"]);
    expect(parseCashtags("", "QQQ")).toEqual(["QQQ"]);
  });

  it("cuts a caption into text and linkable registry tags only", () => {
    expect(captionParts("long $NVDA, not $XYZ")).toEqual([{ text: "long " }, { text: "$NVDA", symbol: "NVDA" }, { text: ", not $XYZ" }]);
  });
});
