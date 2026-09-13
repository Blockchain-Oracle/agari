import type { LedgerFill } from "@masayume/core/projection";
import type { Reading } from "@masayume/core/schemas";
import type { Address } from "@masayume/core/types";
import { toLedgerFill } from "../mappers/fill";
import { getClient } from "../runtime/read-runtime";
import { withReading } from "./reading";

export interface WalletFillsQuery {
  /** The pool the fills executed on — a Window's `poolAddress`. Callers still filter on `marketId`: pools are recycled. */
  pool?: Address;
  /** Only fills at or after this unix second. */
  sinceSec?: number;
  limit?: number;
}

const DEFAULT_LIMIT = 200;

/**
 * A wallet's own fills, narrowed to one pool and a time — the light read for "did this transaction fill,
 * and for how much", which `listWalletHistory` answers only by paging the whole tape. Fills the indexer
 * has not yet attributed to a seat are dropped, as the ledger drops them; the caller treats an empty
 * answer as "not on the tape yet", never as "nothing filled".
 */
export async function listWalletFills(wallet: Address, query: WalletFillsQuery = {}): Promise<Reading<LedgerFill[]>> {
  return withReading(`fills:${wallet}:${query.pool ?? "*"}:${query.sinceSec ?? 0}`, async () => {
    const rows = await getClient().getUserFills(wallet, {
      limit: query.limit ?? DEFAULT_LIMIT,
      ...(query.pool ? { pool: query.pool } : {}),
      ...(query.sinceSec !== undefined ? { since: query.sinceSec } : {}),
    });
    return rows.map((row) => toLedgerFill(wallet, row)).filter((fill): fill is LedgerFill => fill !== null);
  });
}
