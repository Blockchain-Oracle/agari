/**
 * Practice desks (desk.md §7): the paper ledger is the state. It moves at the Jupiter quote net of PreStocks' fee
 * when the desk "would have acted", and a practice fill is written as a confirmed action too, so the owner's rolling
 * daily limit and the outside-money check work the same way on both kinds of desk.
 */
import { applyPaperFill, paperFeeBpsFor, paperLedgerFromWire, paperLedgerToWire, type DeskSide, type PaperLedger } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import type { Db, DeskQueries } from "@agari/db";

export async function loadPaper(q: DeskQueries, deskId: string): Promise<PaperLedger | null> {
  const row = await q.getPaper(deskId);
  return row ? paperLedgerFromWire({ cashE6: row.cashE6, positions: row.positions as Partial<Record<PreIpoSymbol, string>> }) : null;
}

export async function savePaper(q: DeskQueries, deskId: string, ledger: PaperLedger, nowSec: number, tx?: Db): Promise<void> {
  const wire = paperLedgerToWire(ledger);
  await q.savePaper({ deskId, cashE6: wire.cashE6, positions: wire.positions as Record<string, string>, nowSec }, tx);
}

/** The ledger after a would-have fill at the quote, less the fee when the route's venue quotes gross (C6.E). */
export function paperFill(ledger: PaperLedger, fill: { side: DeskSide; symbol: PreIpoSymbol; amountIn: bigint; quoteOut: bigint }, routeLabels: readonly string[]): PaperLedger {
  return applyPaperFill(ledger, { ...fill, feeBps: paperFeeBpsFor(routeLabels) });
}

export const paperPositions = (ledger: PaperLedger): Record<string, bigint> => Object.fromEntries(Object.entries(ledger.positions).filter(([, raw]) => raw !== undefined && raw > 0n) as [string, bigint][]);
