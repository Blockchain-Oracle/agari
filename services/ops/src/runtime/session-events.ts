/**
 * Session events every venue actor shares (session-lanes.md §3.3–3.4): corporate skips and xStock multiplier changes
 * from `config/corporate-actions.json` (re-read when the file changes, so a committed entry applies without a restart)
 * and the earnings calendar, which only `calendar/earnings.ts` writes.
 */
import { readFileSync, statSync } from "node:fs";
import { isTickerSymbol, XSTOCK_SYMBOLS } from "@agari/core/market";
import type { CorporateSkip, EarningsEvent, LaneBasis, MultiplierChange } from "@agari/core/types";

const CORPORATE_ACTIONS = new URL("../../config/corporate-actions.json", import.meta.url);
const LANES: readonly string[] = ["regular", "gap", "token"] satisfies LaneBasis[];
const ET_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^\d+(\.\d+)?$/;

export interface SessionEvents {
  skips(): readonly CorporateSkip[];
  multipliers(): readonly MultiplierChange[];
  /** Null until the first successful earnings fetch: a surface then shows no earnings flag rather than "none". */
  earnings(): readonly EarningsEvent[] | null;
  setEarnings(events: readonly EarningsEvent[]): void;
  /** Why an entry of the file was dropped, for the heartbeat; empty when every entry parsed. */
  problems(): readonly string[];
}

type Parsed = { skips: CorporateSkip[]; multipliers: MultiplierChange[]; problems: string[] };

function parseSkip(raw: unknown): CorporateSkip | null {
  const r = raw as Partial<Record<keyof CorporateSkip, unknown>>;
  if (!isTickerSymbol(r?.symbol) || typeof r.date !== "string" || !ET_DATE.test(r.date) || typeof r.why !== "string") return null;
  if (r.lanes !== undefined && !(Array.isArray(r.lanes) && r.lanes.every((l) => LANES.includes(l)))) return null;
  return { symbol: r.symbol, date: r.date, why: r.why, ...(r.lanes ? { lanes: r.lanes as LaneBasis[] } : {}) };
}

function parseMultiplier(raw: unknown): MultiplierChange | null {
  const r = raw as Partial<Record<keyof MultiplierChange, unknown>>;
  if (!(XSTOCK_SYMBOLS as readonly unknown[]).includes(r?.xstock) || !Number.isInteger(r.effectiveSec) || typeof r.why !== "string") return null;
  if (typeof r.from !== "string" || !DECIMAL.test(r.from) || typeof r.to !== "string" || !DECIMAL.test(r.to)) return null;
  return { xstock: r.xstock as MultiplierChange["xstock"], effectiveSec: r.effectiveSec as number, from: r.from, to: r.to, why: r.why };
}

function parseFile(text: string): Parsed {
  const json = JSON.parse(text) as { skips?: unknown[]; multipliers?: unknown[] };
  const out: Parsed = { skips: [], multipliers: [], problems: [] };
  for (const [i, raw] of (json.skips ?? []).entries()) {
    const skip = parseSkip(raw);
    if (skip) out.skips.push(skip);
    else out.problems.push(`skips[${i}] malformed`);
  }
  for (const [i, raw] of (json.multipliers ?? []).entries()) {
    const change = parseMultiplier(raw);
    if (change) out.multipliers.push(change);
    else out.problems.push(`multipliers[${i}] malformed`);
  }
  return out;
}

export function createSessionEvents(file: URL = CORPORATE_ACTIONS): SessionEvents {
  let parsed: Parsed = { skips: [], multipliers: [], problems: [] };
  let mtimeMs = -1;
  let earnings: readonly EarningsEvent[] | null = null;

  const current = (): Parsed => {
    try {
      const stat = statSync(file);
      if (stat.mtimeMs !== mtimeMs) {
        parsed = parseFile(readFileSync(file, "utf8"));
        mtimeMs = stat.mtimeMs;
      }
    } catch (error) {
      // A missing or unreadable file keeps the last good entries (none on a fresh boot).
      parsed = { ...parsed, problems: [`corporate-actions.json: ${error instanceof Error ? error.message : String(error)}`] };
    }
    return parsed;
  };

  return {
    skips: () => current().skips,
    multipliers: () => current().multipliers,
    earnings: () => earnings,
    setEarnings(events) {
      earnings = [...events];
    },
    problems: () => current().problems,
  };
}
