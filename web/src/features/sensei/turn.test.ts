import { TICKER_SYMBOLS } from "@agari/core/market";
import { describe, expect, it } from "vitest";
import { asksForAdvice, senseiTurnContext } from "./prompt";
import type { SenseiRequest } from "./protocol";
import { earningsLine } from "./turn-lines";
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

  // Eight positions and four Windows are the request's ceilings; stakes at a whole faucet claim ($10,000) each.
  it("stays under 2 KB at the request's ceilings", () => {
    const request: SenseiRequest = {
      messages: [user("should I sell my shares?")],
      restless: true,
      session: { state: "early-close", label: "Closes 13:00 ET today" },
      record: { settled: 9_999, wins: 4_999, losses: 4_999, streak: -12 },
      positions: Array.from({ length: 8 }, () => ({ asset: "GOOGL", cadence: "15m", side: "both" as const, stakeCents: 1_000_000, markCents: 1_000_000, minsToClose: 59 })),
      snapshot: {
        priceUsd: { GOOGL: 999.99 },
        markets: Array.from({ length: 4 }, () => ({ asset: "GOOGL", cadence: "15m", minsToClose: 59, lineUsd: 999.99, upCents: 100, downCents: 100 })),
      },
    };
    const events = TICKER_SYMBOLS.map((symbol) => ({ symbol, dateEt: "2026-09-17", hour: "dmh" as const }));
    const context = senseiTurnContext(request, { adviceAsked: true, earnings: { events, symbols: [...TICKER_SYMBOLS] } });
    expect(new TextEncoder().encode(context).length).toBeLessThanOrEqual(2_048);
  });
});
