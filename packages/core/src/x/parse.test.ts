import { describe, expect, it } from "vitest";
import { parseInstruction } from "./parse";

const DEC = 6;
const ok = (text: string) => {
  const parsed = parseInstruction(text, { decimals: DEC });
  if (!parsed.ok) throw new Error(`expected ok, got ${parsed.reason}`);
  return parsed.instruction;
};
const refused = (text: string) => {
  const parsed = parseInstruction(text, { decimals: DEC });
  if (parsed.ok) throw new Error("expected a refusal");
  return parsed.reason;
};

describe("parseInstruction", () => {
  it("reads the canonical grammar", () => {
    expect(ok("@agari tsla up 5 15m")).toEqual({ side: "up", asset: "TSLA", cadence: "15m", intervalSec: 900, stakeBase: 5_000_000n });
  });
  it("accepts any token order, a $ sign, decimals and synonyms", () => {
    expect(ok("@agari 1h $10.5 DOWN nvda")).toEqual({ side: "down", asset: "NVDA", cadence: "1h", intervalSec: 3_600, stakeBase: 10_500_000n });
    expect(ok("tesla long 25 usdc 5m please")).toMatchObject({ side: "up", asset: "TSLA", cadence: "5m" });
    expect(ok("short alphabet 1 1h")).toMatchObject({ side: "down", asset: "GOOGL", cadence: "1h" });
    expect(ok("META up 2 15m")).toMatchObject({ asset: "META" });
  });
  it.each(["TSLA long 5 5 minutes", "tsla up 5 5min", "TSLA up 5 5 mins"])("accepts written minute units: %s", text => {
    expect(ok(text)).toMatchObject({ asset: "TSLA", side: "up", stakeBase: 5_000_000n, intervalSec: 300 });
  });
  it.each(["1m", "4h", "1d", "24h", "24 hours", "1 day"])("refuses a cadence the Regular lane does not run: %s", duration => {
    expect(refused(`TSLA up 5 ${duration}`)).toBe("cadence-not-listed");
  });
  it("refuses every ambiguity by name", () => {
    expect(refused("@agari tsla up down 5 15m")).toBe("two-sides");
    expect(refused("tsla nvidia up 5 15m")).toBe("two-assets");
    expect(refused("tsla up 5 10 15m")).toBe("two-stakes");
    expect(refused("tsla up 5 15m 1h")).toBe("two-cadences");
  });
  it("refuses what is missing or unknown", () => {
    expect(refused("tsla 5 15m")).toBe("no-side");
    expect(refused("up 5 15m")).toBe("no-asset");
    expect(refused("sol up 5 15m")).toBe("unknown-asset");
    expect(refused("btc up 5 15m")).toBe("unknown-asset");
    expect(refused("tsla up 15m")).toBe("no-stake");
    expect(refused("tsla up 5")).toBe("no-cadence");
    expect(refused("tsla up 5 30m")).toBe("cadence-not-listed");
    expect(refused("tsla up 0 15m")).toBe("bad-stake");
    expect(refused("tsla up 5 15m 3x")).toBe("unknown-token");
    expect(refused("@agari")).toBe("empty");
  });
  it("refuses a stake finer than the collateral", () => {
    expect(refused("tsla up 0.0000001 15m")).toBe("bad-stake");
  });
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])("never treats inherited dictionary key %s as an asset or side", (token) => {
    expect(refused(`${token} tsla 5 15m`)).toBe("no-side");
    expect(refused(`${token} up 5 15m`)).toBe("no-asset");
    expect(ok(`${token} tsla up 5 15m`)).toMatchObject({ side: "up", asset: "TSLA" });
  });
});
