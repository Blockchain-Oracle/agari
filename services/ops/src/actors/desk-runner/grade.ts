/**
 * Marking the desk's own homework a day later (core `grade.ts`, plan §5.8): the price it decided on, from the record
 * itself, against the hourly PreStocks mark a day after. Both are prices the desk could really have got. A record
 * without a name, a side or a price is graded "ungradable", never quietly a win.
 */
import { GRADE_AFTER_SEC, gradeDecision, OUTCOME_COLUMN, parseDecimal, PRICE_DECIMALS, type PlannedOutcome } from "@agari/core/desk";
import type { DeskRow } from "@agari/db";
import type { RunnerContext } from "./types";

/** The price the desk was looking at when it decided: the spot in its evidence, else the holding's spot. */
export function priceAtDecision(body: Record<string, unknown>, symbol: string | null): bigint | undefined {
  const evidence = body.evidence as { kind?: string; spot?: string }[] | undefined;
  const price = evidence?.find((e) => e.kind === "price")?.spot;
  if (typeof price === "string") return parseDecimal(price, PRICE_DECIMALS) ?? undefined;
  const holdings = (body.valuation as { holdings?: { symbol: string; spot: string | null }[] } | null)?.holdings ?? [];
  const spot = holdings.find((h) => h.symbol === symbol)?.spot;
  return typeof spot === "string" ? (parseDecimal(spot, PRICE_DECIMALS) ?? undefined) : undefined;
}

/** Grades every record of `desk` that is a day old and has a mark to compare against. Returns how many were graded. */
export async function gradeDue(ctx: RunnerContext, desk: DeskRow, nowSec: number): Promise<number> {
  let graded = 0;
  for (const row of await ctx.q.ungradedRecords({ deskId: desk.id, beforeSec: nowSec - GRADE_AFTER_SEC })) {
    const later = row.symbol ? await ctx.q.priceMarkAtOrAfter({ symbol: row.symbol, atSec: row.decidedAtSec + GRADE_AFTER_SEC }) : null;
    const priceThenE8 = priceAtDecision(row.body, row.symbol);
    // A mark that does not exist yet is not "ungradable": the desk waits for the hour that brings it.
    if (row.symbol && row.side && priceThenE8 && !later) continue;
    const grade = gradeDecision({ outcome: OUTCOME_COLUMN[row.outcome as PlannedOutcome] ?? row.outcome, side: row.side ?? undefined, priceThenE8, priceLaterE8: later ? BigInt(later.tokenE8) : undefined });
    await ctx.q.saveGrade({
      deskId: desk.id,
      recordSeq: row.seq,
      gradedAtSec: nowSec,
      verdict: grade.verdict,
      differenceBps: grade.differenceBps,
      priceThenE8: priceThenE8?.toString() ?? null,
      priceLaterE8: later?.tokenE8 ?? null,
      chosen: grade.chosen,
      alternative: grade.alternative,
      why: grade.why,
      countsForTiming: grade.countsForTiming,
    });
    graded += 1;
    ctx.log(`desk ${desk.id.slice(0, 8)} record ${row.seq}: ${grade.verdict}. ${grade.why}`);
  }
  return graded;
}
