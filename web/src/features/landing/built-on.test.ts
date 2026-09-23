import { describe, expect, it } from "vitest";
import { builtOnTally, namesLine, type MixRow } from "./built-on";

const row = (symbol: string | null, which: number | null, source: number | null, windows: number): MixRow => ({ symbol, which, source, windows });

describe("builtOnTally (S25: the landing counts only what the print mix holds)", () => {
  it("counts closes by source, PreStocks only on pre-IPO names and baskets, and names them in registry order", () => {
    const t = builtOnTally([
      row("OPENAI", 0, 4, 60),
      row("OPENAI", 1, 4, 58),
      row("AILABS", 1, 4, 14),
      row("PREALL", 1, 4, 14),
      row(null, 1, 4, 15),
      row("VOO", 1, 1, 466),
      row("TSLA", 1, 1, 455),
      row("TSLA", 3, 2, 400),
      row("NVDA", 1, 2, 504),
      row("NVDA", 1, 3, 21),
    ]);
    expect(t.prestocks).toEqual({ windows: 86, names: ["OPENAI"], baskets: ["AILABS", "PREALL"] });
    expect(t.pyth).toEqual({ windows: 921, names: ["TSLA", "VOO"], baskets: [] });
  });

  it("drops a source that stopped closing Windows", () => {
    expect(builtOnTally([row("TSLA", 1, 2, 10)]).pyth).toEqual({ windows: 0, names: [], baskets: [] });
  });
});

describe("namesLine", () => {
  it("names a pre-IPO name by its company and a listed name by its ticker", () => {
    expect(namesLine(["OPENAI"])).toBe("OpenAI");
    expect(namesLine(["TSLA", "QQQ", "VOO"])).toBe("TSLA, QQQ and VOO");
    expect(namesLine([])).toBe("");
  });
});
