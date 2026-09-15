/**
 * An injected halt fixture (`HALT_WATCH_FIXTURE=<json>`, dev proof only; session-lanes.md §6 "plus an injected
 * fixture"): raw source observations that replace the live ones for the assets it names, so the real rules decide.
 * Every pass that uses one says FIXTURE in its why-string. See `fixtures/halted-session.json`.
 */
import { readFileSync } from "node:fs";
import { isTickerSymbol, XSTOCK_SYMBOLS, type XStockSymbol } from "@agari/core/market";
import type { Observations } from "./decide";

export interface HaltFixture {
  name: string;
  /** "regular" watches the stock lanes whatever the calendar says. */
  session: "regular" | null;
  pyth: Record<string, { price: string; conf: string; ageSec: number }>;
  redstone: Record<string, { ageSec: number }>;
  issuer: Record<string, boolean>;
  quoteFailures: Record<string, number>;
}

const isXStock = (v: string): v is XStockSymbol => (XSTOCK_SYMBOLS as readonly string[]).includes(v);

/** Null without the env var; throws on a malformed file (a proof run must not silently run live). */
export function loadHaltFixture(path: string | undefined): HaltFixture | null {
  if (!path) return null;
  const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<HaltFixture>;
  return {
    name: path.split("/").at(-1) ?? path,
    session: raw.session === "regular" ? "regular" : null,
    pyth: raw.pyth ?? {},
    redstone: raw.redstone ?? {},
    issuer: raw.issuer ?? {},
    quoteFailures: raw.quoteFailures ?? {},
  };
}

/**
 * Overwrites the named assets' observations (ages are relative to `nowSec`, so a fixture stays halted while it runs).
 * `session` is read by the caller before the boot grace, so a fixture never skips it.
 */
export function applyFixture(o: Observations, f: HaltFixture): void {
  for (const [symbol, t] of Object.entries(f.pyth)) {
    if (isTickerSymbol(symbol)) o.pyth[symbol] = { price: BigInt(t.price), conf: BigInt(t.conf), publishTimeSec: o.nowSec - t.ageSec };
  }
  for (const [symbol, r] of Object.entries(f.redstone)) if (isTickerSymbol(symbol)) o.redstoneNewestSec[symbol] = o.nowSec - r.ageSec;
  for (const [xstock, halted] of Object.entries(f.issuer)) if (isXStock(xstock)) o.issuer[xstock] = halted;
  for (const [xstock, n] of Object.entries(f.quoteFailures)) if (isXStock(xstock)) o.quoteFailures[xstock] = n;
}
