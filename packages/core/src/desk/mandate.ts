/**
 * The mandate (desk.md §8, plan §5.4): WHAT the owner wants held, and the limits the desk must stay inside. The owner
 * writes it; the desk never invents a position and decides only when.
 *
 * Targets are basis points of the whole desk and, with cash, total exactly 10,000. Money is bigint USDC at 6 dp. Names
 * are the PreStocks catalogue symbols the registry knows (`PRE_IPO_SYMBOLS`); the markets layer resolves them to mints.
 * Two of the limits are the program's own (`perActionCapE6`, `dailyCapE6`, `maxPremiumBps`: `owner_open_desk` and
 * `owner_set_limits`); the rest are enforced by the desk's code before anything is sent.
 */
import { z } from "zod";
import { PRE_IPO_SYMBOLS, TICKERS, type PreIpoSymbol } from "../market/tickers";
import { pct } from "./units";

export const MANDATE_NOTES_MAX_CHARS = 2000;
export const MANDATE_MAX_TOKENS = 8;

const bps = z.number().int().min(0).max(10_000);
const usdcE6 = z.bigint().positive();
/** An integer decimal string: bigint USDC base units on the wire (the wire carries no bigint). */
const usdcWire = z.string().regex(/^\d+$/, "USDC base units as an integer string");

export const deskTargetsSchema = z.strictObject({
  cashBps: bps,
  tokens: z.array(z.strictObject({ symbol: z.enum(PRE_IPO_SYMBOLS), weightBps: bps.min(1) })).max(MANDATE_MAX_TOKENS),
});
export type DeskTargets = z.infer<typeof deskTargetsSchema>;

const limits = {
  /** The preset the targets came from, or null for a hand-built basket. */
  preset: z.string().max(40).nullable(),
  targets: deskTargetsSchema,
  /** How far a holding's share may wander from its target before the desk considers acting. */
  driftToleranceBps: bps,
  /** The most any single holding may be, as a share of the desk. */
  maxPositionBps: bps,
  /** If the desk's value falls this far below its baseline, everything stops. */
  lossStopBps: bps,
  /** Never buy a name more than this above its mark (the program enforces its own copy). */
  maxPremiumBps: bps,
  /** The owner's own words. They reach the model as context for WHEN, never as an instruction to size or hold. */
  notes: z.string().max(MANDATE_NOTES_MAX_CHARS),
};

export const deskMandateSchema = z.strictObject({
  ...limits,
  /** The most the desk may spend in one action, and in one day. The chain enforces its own copies too. */
  perActionCapE6: usdcE6,
  dailyCapE6: usdcE6,
  /** At or above this size the desk asks first, even in "on its own" mode. */
  largeActionE6: usdcE6,
});
export type DeskMandate = z.infer<typeof deskMandateSchema>;

/** The mandate as the API and the database carry it: money as integer strings. */
export const deskMandateWireSchema = z.strictObject({ ...limits, perActionCapE6: usdcWire, dailyCapE6: usdcWire, largeActionE6: usdcWire });
export type DeskMandateWire = z.infer<typeof deskMandateWireSchema>;

export function mandateToWire(m: DeskMandate): DeskMandateWire {
  return { ...m, perActionCapE6: m.perActionCapE6.toString(), dailyCapE6: m.dailyCapE6.toString(), largeActionE6: m.largeActionE6.toString() };
}

export function mandateFromWire(wire: DeskMandateWire): DeskMandate {
  const parsed = deskMandateWireSchema.parse(wire);
  return deskMandateSchema.parse({
    ...parsed,
    perActionCapE6: BigInt(parsed.perActionCapE6),
    dailyCapE6: BigInt(parsed.dailyCapE6),
    largeActionE6: BigInt(parsed.largeActionE6),
  });
}

/** The company name the owner knows a symbol by ("OpenAI"), never the ticker. */
export const nameOf = (symbol: PreIpoSymbol): string => TICKERS[symbol].name;

/**
 * Everything a schema cannot say on its own, as plain sentences naming companies the way the owner knows them.
 * Empty means the mandate holds together.
 */
export function checkMandate(m: DeskMandate): string[] {
  const problems: string[] = [];
  const seen = new Set<PreIpoSymbol>();
  let total = m.targets.cashBps;
  for (const t of m.targets.tokens) {
    const name = nameOf(t.symbol);
    if (seen.has(t.symbol)) problems.push(`${name} is listed twice`);
    if (t.weightBps > m.maxPositionBps) problems.push(`${name} has a target of ${pct(t.weightBps)}, above the largest holding you allow (${pct(m.maxPositionBps)})`);
    seen.add(t.symbol);
    total += t.weightBps;
  }
  if (m.targets.tokens.length === 0) problems.push("the basket names no company");
  if (total !== 10_000) problems.push(`the targets and cash add up to ${pct(total)}, not 100%`);
  if (m.dailyCapE6 < m.perActionCapE6) problems.push("the daily limit is below the per-action limit");
  if (m.driftToleranceBps === 0) problems.push("a tolerance of zero would make the desk trade on every wobble");
  if (m.lossStopBps === 0) problems.push("a loss limit of zero would stop the desk at once");
  if (m.maxPremiumBps === 0) problems.push("a premium ceiling of zero would refuse every name that trades above its mark, which today is most of them");
  return problems;
}

/** The basket in one sentence for the studio's side card and the model: "50% OpenAI · 30% Anthropic · 20% cash". */
export function describeTargets(t: DeskTargets): string {
  const parts = t.tokens.map((x) => `${pct(x.weightBps)} ${nameOf(x.symbol)}`);
  if (t.cashBps > 0) parts.push(`${pct(t.cashBps)} cash`);
  return parts.join(" · ");
}
