import { TICKER_SYMBOLS } from "@agari/core/market";
import { describe, expect, it } from "vitest";
import { asksForAdvice, senseiTurnContext } from "./prompt";
import type { SenseiRequest } from "./protocol";
import { basketCoverLine, earningsLine, holdingsLine } from "./turn-lines";
import { baseToCents, centsText } from "./units";

const user = (content: string) => ({ role: "user" as const, content });

describe("Sensei per-turn context (S13 spec §1.1)", () => {
  it("trips on real-money advice in the last user turn only", () => {
    expect(asksForAdvice([user("should I sell my TSLA shares before earnings?")])).toBe(true);
    expect(asksForAdvice([user("is it time to\nbuy NVDA stock")])).toBe(true);
    expect(asksForAdvice([user("what about my 401k")])).toBe(true);
    expect(asksForAdvice([user("one more, I need to win it back")])).toBe(false);
    expect(asksForAdvice([user("Up or down on the next close?")])).toBe(false);
    expect(asksForAdvice([user("sell my shares?"), { role: "assistant", content: "I can't advise on that." }, user("ok, read TSLA 5m")])).toBe(false);
  });

  it("states what the wallet holds as a fact with its one use, cover, and keeps the token behind the advice line", () => {
    const line = holdingsLine([
      { name: "OpenAI", symbol: "OPENAI", issuer: "prestocks", tokens: "4.2", valueCents: 473_400 },
      { name: "Tesla", symbol: "TSLAx", issuer: "xstocks", tokens: "12.5", valueCents: null },
    ]);
    expect(line).toContain("4.2 OPENAI (OpenAI, PreStocks) about $4,734.00");
    expect(line).toContain("12.5 TSLAx (Tesla, xStocks).");
    expect(line).toContain("DOWN Window on that name is cover with test funds");
    expect(line).toContain("Never advise on the tokens themselves");
    expect(holdingsLine([])).toBe("Their wallet holds no stock tokens (real tokens, read-only).");
    // The tripwire is unchanged by the summary: a question about the real tokens still trips on "shares/stocks", and a cover question does not.
    expect(asksForAdvice([user("should I sell my OpenAI stock now?")])).toBe(true);
    expect(asksForAdvice([user("can I cover my OpenAI with a Down Window?")])).toBe(false);
    const context = senseiTurnContext({ messages: [], restless: false, snapshot: null, holdings: [{ name: "OpenAI", symbol: "OPENAI", issuer: "prestocks", tokens: "4.2", valueCents: 473_400 }] });
    expect(context).toContain("Their wallet holds");
  });

  it("stakes travel as integer cents, rounded half up", () => {
    expect(baseToCents(12_504_999n, 6)).toBe(1_250);
    expect(baseToCents(12_505_000n, 6)).toBe(1_251);
    expect(centsText(120_400)).toBe("$1,204.00");
    expect(centsText(5)).toBe("$0.05");
  });

  it("says closed and when it opens off-hours, and states a losing run the way the Brake reads it", () => {
    const context = senseiTurnContext({
      messages: [],
      restless: false,
      snapshot: null,
      session: { state: "closed", label: "Opens Wed 09:30 ET" },
      record: { settled: 9, wins: 3, losses: 6, streak: -3 },
    });
    expect(context).toContain("Market closed, opens Wed 09:30 ET.");
    expect(context).toContain("lost the last 3");
    expect(context).not.toContain("No live market data");
  });

  it("formats earnings by ET weekday and hour, and says when the calendar is unreadable", () => {
    const line = earningsLine({ events: [{ symbol: "NVDA", dateEt: "2026-09-17", hour: "amc" }], symbols: ["NVDA", "TSLA"] });
    expect(line).toBe("Earnings within 14 days: NVDA reports Thu 09-17 after the close.");
    expect(earningsLine({ events: null, symbols: ["TSLA"] })).toContain("could not be read");
  });

  // Eight positions, four Windows and four holdings are the request's ceilings; stakes at a whole faucet claim ($10,000) each.
  it("stays under 2.5 KB at the request's ceilings (D-104)", () => {
    const request: SenseiRequest = {
      messages: [user("should I sell my shares?")],
      restless: true,
      session: { state: "early-close", label: "Closes 13:00 ET today" },
      record: { settled: 9_999, wins: 4_999, losses: 4_999, streak: -12 },
      positions: Array.from({ length: 8 }, () => ({ asset: "GOOGL", cadence: "15m", side: "both" as const, stakeCents: 1_000_000, markCents: 1_000_000, minsToClose: 59 })),
      holdings: Array.from({ length: 4 }, () => ({ name: "Polymarket", symbol: "POLYMARKET", issuer: "prestocks" as const, tokens: "1234.5678", valueCents: 1_000_000_000 })),
      snapshot: {
        priceUsd: { GOOGL: 999.99 },
        markets: Array.from({ length: 4 }, () => ({ asset: "GOOGL", cadence: "15m", minsToClose: 59, lineUsd: 999.99, upCents: 100, downCents: 100 })),
      },
    };
    const events = TICKER_SYMBOLS.map((symbol) => ({ symbol, dateEt: "2026-09-17", hour: "dmh" as const }));
    const context = senseiTurnContext(request, { adviceAsked: true, earnings: { events, symbols: [...TICKER_SYMBOLS] } });
    expect(new TextEncoder().encode(context).length).toBeLessThanOrEqual(2_560);
  });
});

describe("basket cover line (S19)", () => {
  it("names a basket only when two or more of its members are held, and says how many", () => {
    const openai = { name: "OpenAI", symbol: "OPENAI", issuer: "prestocks", tokens: "4.2", valueCents: 473_400 } as const;
    const anthropic = { name: "Anthropic", symbol: "ANTHROPIC", issuer: "prestocks", tokens: "2", valueCents: 206_200 } as const;
    const tesla = { name: "Tesla", symbol: "TSLAx", issuer: "xstocks", tokens: "12.5", valueCents: null } as const;
    expect(basketCoverLine([openai, tesla])).toBe("");
    const line = basketCoverLine([openai, anthropic, tesla]);
    expect(line).toContain("AILABS (AI Labs: they hold 2 of its 2 members)");
    expect(line).toContain("FRONTIER (Frontier AI: they hold 2 of its 4 members)");
    expect(line).toContain("PREALL");
    expect(line).not.toContain("PREDMKTS");
    expect(holdingsLine([openai, anthropic])).toContain("A DOWN Window on a basket covers the members they hold together");
  });
});
