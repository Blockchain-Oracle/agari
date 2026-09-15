/**
 * The venue-wide scan the board and traction share (proof-analytics.md §2.3): exactly three paged index scans, never a
 * request per wallet, Book or Window. Masayume paged fills per pool and router actions per wallet (`scan.ts:57-80`); the
 * indexer serves the whole tape by time instead. A page cap is reported as `complete: false`, never papered over.
 */
import type { LedgerFill, LedgerSetAction } from "@agari/core/projection";
import type { Address, MarketId, Signature } from "@agari/core/types";
import { toLedgerFill } from "./history";
import { big, indexRows, sec, type ActionRow, type FillRow, type MarketRow } from "./index-api";

const PAGE = 1_000;
const MAX_PAGES = 10;

/** A `tape/actions` row: a `CompleteSet` with its owner lifted out of the event data. */
export interface TapeActionRow extends ActionRow {
  owner: string | null;
}

export interface Paged<T> {
  rows: T[];
  complete: boolean;
}

export interface TapeScan {
  /** Registry Windows in scope, by id; the drive-only Series (no symbol) is no one's round (as in `history.ts`). */
  rowById: Map<string, MarketRow>;
  fills: FillRow[];
  actions: TapeActionRow[];
  complete: boolean;
}

export interface TapeBounds {
  windowStartMs: number;
  windowEndMs: number;
  lookbackSec: number;
}

async function pageTape<T>(path: string, query: Record<string, number>): Promise<Paged<T>> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await indexRows<T>(path, { ...query, limit: PAGE, offset: page * PAGE });
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** `atMs ≥ startMs` and `atMs < endMs` on whole seconds are `sec ≥ ceil(startMs / 1000)` and `sec < ceil(endMs / 1000)`. */
export const ceilSec = (ms: number) => Math.ceil(ms / 1000);

export async function scanTape(bounds: TapeBounds): Promise<TapeScan> {
  const from = ceilSec(bounds.windowStartMs);
  const to = ceilSec(bounds.windowEndMs);
  // A Window that settled inside the window traded before it settled, so its tape ends at the window's end too.
  const [markets, fills, actions] = await Promise.all([
    pageTape<MarketRow>("tape/markets", { from, to, lookback: bounds.lookbackSec }),
    pageTape<FillRow>("tape/fills", { since: bounds.lookbackSec, until: to }),
    pageTape<TapeActionRow>("tape/actions", { since: bounds.lookbackSec, until: to }),
  ]);
  const rowById = new Map(markets.rows.filter((row) => row.symbol !== null).map((row) => [row.market, row]));
  return {
    rowById,
    fills: fills.rows.filter((fill) => rowById.has(fill.market)),
    actions: actions.rows.filter((action) => action.market !== null && rowById.has(action.market)),
    complete: markets.complete && fills.complete && actions.complete,
  };
}

const gridOf = (row: MarketRow | undefined) => (row && row.lot_base !== null && row.tick_base !== null ? { lotBase: big(row.lot_base), tickBase: big(row.tick_base) } : undefined);

function toSetAction(action: TapeActionRow, row: MarketRow | undefined): LedgerSetAction | null {
  const grid = gridOf(row);
  if (!grid || !action.market) return null;
  const data = action.data as { minted?: boolean; lots?: string };
  return {
    marketId: action.market as MarketId,
    kind: data.minted ? "mint" : "merge",
    amountRaw: big(data.lots) * grid.lotBase,
    atMs: sec(action.block_time_sec) * 1000,
    txHash: action.signature as Signature,
  };
}

export interface WalletTape {
  fills: LedgerFill[];
  sets: LedgerSetAction[];
}

/**
 * Each participant's own side of the tape in one pass (Masayume mapped every fill once per wallet). A wallet is a
 * participant when it took or made a fill; operator wallets are left out (Q-S5-2).
 */
export function walletTapes(scan: TapeScan, operators: ReadonlySet<string>): Map<Address, WalletTape> {
  const out = new Map<Address, WalletTape>();
  const tapeOf = (wallet: string) => {
    let tape = out.get(wallet as Address);
    if (!tape) out.set(wallet as Address, (tape = { fills: [], sets: [] }));
    return tape;
  };
  for (const fill of scan.fills) {
    const grid = gridOf(scan.rowById.get(fill.market));
    for (const wallet of fill.taker === fill.maker ? [fill.taker] : [fill.taker, fill.maker]) {
      if (operators.has(wallet)) continue;
      const own = toLedgerFill(wallet as Address, fill, grid);
      const tape = tapeOf(wallet);
      if (own) tape.fills.push(own);
    }
  }
  for (const action of scan.actions) {
    const tape = action.owner ? out.get(action.owner as Address) : undefined;
    const set = tape ? toSetAction(action, scan.rowById.get(action.market ?? "")) : null;
    if (tape && set) tape.sets.push(set);
  }
  return out;
}
