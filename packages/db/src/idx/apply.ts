/**
 * Projection writes for one decoded agari-events event (schema-index.ts). Runs inside the writer's DB transaction and
 * assumes a Market's events arrive in `seq` order; the writer rebuilds a Market whose events arrived out of order.
 */
import type postgres from "postgres";
import type { IdxEvent } from "./types";

type Tx = postgres.TransactionSql;
type Data = Record<string, unknown>;
const PAIR_TICKS = 1000n;

const str = (d: Data, key: string): string => {
  const v = d[key];
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  throw new Error(`event field ${key} missing`);
};
const num = (d: Data, key: string): number => Number(str(d, key));
const bool = (d: Data, key: string): boolean => d[key] === true;
const list = (d: Data, key: string): Data[] => (Array.isArray(d[key]) ? (d[key] as Data[]) : []);

/** Kind → (outcome delta, cash direction) for one fill leg at maker price `price` (engine §2.1: uniform by kind). */
function leg(kind: number, lots: bigint, price: bigint) {
  const yesCash = lots * price;
  const noCash = lots * (PAIR_TICKS - price);
  switch (kind) {
    case 0: return { yes: lots, no: 0n, boughtYes: lots, soldYes: 0n, boughtNo: 0n, soldNo: 0n, paid: yesCash, received: 0n };
    case 1: return { yes: -lots, no: 0n, boughtYes: 0n, soldYes: lots, boughtNo: 0n, soldNo: 0n, paid: 0n, received: yesCash };
    case 2: return { yes: 0n, no: lots, boughtYes: 0n, soldYes: 0n, boughtNo: lots, soldNo: 0n, paid: noCash, received: 0n };
    case 3: return { yes: 0n, no: -lots, boughtYes: 0n, soldYes: 0n, boughtNo: 0n, soldNo: lots, paid: 0n, received: noCash };
    default: throw new Error(`unknown kind ${kind}`);
  }
}

async function positionFill(tx: Tx, e: IdxEvent, owner: string, seat: number, kind: number, lots: bigint, price: bigint, tsSec: string) {
  const l = leg(kind, lots, price);
  await tx`
    INSERT INTO idx_positions (market, owner, seat, yes_lots, no_lots, bought_yes_lots, sold_yes_lots, bought_no_lots, sold_no_lots,
      paid_ticklots, received_ticklots, fills, first_ts_sec, last_ts_sec, entry_signature, last_signature)
    VALUES (${e.market}, ${owner}, ${seat}, ${String(l.yes)}::numeric, ${String(l.no)}::numeric, ${String(l.boughtYes)}::numeric, ${String(l.soldYes)}::numeric,
      ${String(l.boughtNo)}::numeric, ${String(l.soldNo)}::numeric, ${String(l.paid)}::numeric, ${String(l.received)}::numeric, 1, ${tsSec}::bigint, ${tsSec}::bigint,
      ${e.signature}, ${e.signature})
    ON CONFLICT (market, owner) DO UPDATE SET
      seat = EXCLUDED.seat,
      yes_lots = idx_positions.yes_lots + EXCLUDED.yes_lots,
      no_lots = idx_positions.no_lots + EXCLUDED.no_lots,
      bought_yes_lots = idx_positions.bought_yes_lots + EXCLUDED.bought_yes_lots,
      sold_yes_lots = idx_positions.sold_yes_lots + EXCLUDED.sold_yes_lots,
      bought_no_lots = idx_positions.bought_no_lots + EXCLUDED.bought_no_lots,
      sold_no_lots = idx_positions.sold_no_lots + EXCLUDED.sold_no_lots,
      paid_ticklots = idx_positions.paid_ticklots + EXCLUDED.paid_ticklots,
      received_ticklots = idx_positions.received_ticklots + EXCLUDED.received_ticklots,
      fills = idx_positions.fills + 1,
      first_ts_sec = COALESCE(idx_positions.first_ts_sec, EXCLUDED.first_ts_sec),
      last_ts_sec = EXCLUDED.last_ts_sec,
      entry_signature = COALESCE(idx_positions.entry_signature, EXCLUDED.entry_signature),
      last_signature = EXCLUDED.last_signature`;
}

async function closeOrder(tx: Tx, e: IdxEvent, r: Data) {
  const reason = num(r, "reason");
  await tx`
    UPDATE idx_orders SET remaining_lots = 0, status = ${reason === 0 ? "expired" : "cancelled"}, removed_reason = ${reason}, updated_seq = ${e.seq}::bigint
    WHERE market = ${e.market} AND rested_node = ${num(r, "node")} AND rested_seq = ${str(r, "seq")}::numeric AND status = 'open'`;
}

async function orderExecuted(tx: Tx, e: IdxEvent) {
  const d = e.data;
  const market = e.market!;
  const ts = str(d, "ts");
  const rested = d.rested as Data;
  const restedLots = BigInt(str(d, "restedLots"));
  await tx`
    INSERT INTO idx_orders (signature, outer_ix, inner_ix, market, seq, ts_sec, owner, seat, kind, order_type, limit_price, lots, expire_ts_sec, client_id,
      filled_lots, cash_spent_base, cash_received_base, cancelled_lots, stop_reason, rested_node, rested_seq, rested_lots, remaining_lots, status, updated_seq)
    VALUES (${e.signature}, ${e.outerIx}, ${e.innerIx}, ${market}, ${e.seq}::bigint, ${ts}::bigint, ${str(d, "taker")}, ${num(d, "takerSeat")}, ${num(d, "kind")},
      ${num(d, "orderType")}, ${num(d, "limitPrice")}, ${str(d, "lots")}::numeric, ${str(d, "expireTs")}::bigint, ${str(d, "clientId")}::numeric,
      ${str(d, "filledLots")}::numeric, ${str(d, "cashSpent")}::numeric, ${str(d, "cashReceived")}::numeric, ${str(d, "cancelledLots")}::numeric,
      ${num(d, "stopReason")}, ${restedLots > 0n ? num(rested, "node") : null}, ${restedLots > 0n ? str(rested, "seq") : null}::numeric,
      ${String(restedLots)}::numeric, ${String(restedLots)}::numeric, ${restedLots > 0n ? "open" : "done"}, ${e.seq}::bigint)
    ON CONFLICT DO NOTHING`;
  const [row] = await tx<{ book: string | null }[]>`SELECT book FROM idx_markets WHERE market = ${market}`;
  const takerKind = num(d, "kind");
  const bucket = String((BigInt(ts) / 60n) * 60n);
  for (const [i, f] of list(d, "fills").entries()) {
    const lots = BigInt(str(f, "lots"));
    const price = BigInt(str(f, "price"));
    const remaining = str(f, "makerRemaining");
    await tx`
      INSERT INTO idx_fills (signature, outer_ix, inner_ix, fill_ix, market, book, seq, slot, ts_sec, taker, taker_seat, taker_kind, maker, maker_seat,
        maker_kind, maker_node, maker_order_seq, path, price_ticks, lots, maker_remaining)
      VALUES (${e.signature}, ${e.outerIx}, ${e.innerIx}, ${i}, ${market}, ${row?.book ?? null}, ${e.seq}::bigint, ${e.slot}, ${ts}::bigint, ${str(d, "taker")},
        ${num(d, "takerSeat")}, ${takerKind}, ${str(f, "maker")}, ${num(f, "makerSeat")}, ${num(f, "makerKind")}, ${num(f, "makerNode")},
        ${str(f, "makerSeq")}::numeric, ${num(f, "path")}, ${Number(price)}, ${String(lots)}::numeric, ${remaining}::numeric)
      ON CONFLICT DO NOTHING`;
    await tx`
      UPDATE idx_orders SET remaining_lots = ${remaining}::numeric, status = CASE WHEN ${remaining}::numeric = 0 THEN 'filled' ELSE status END, updated_seq = ${e.seq}::bigint
      WHERE market = ${market} AND rested_node = ${num(f, "makerNode")} AND rested_seq = ${str(f, "makerSeq")}::numeric AND status = 'open'`;
    await positionFill(tx, e, str(d, "taker"), num(d, "takerSeat"), takerKind, lots, price, ts);
    await positionFill(tx, e, str(f, "maker"), num(f, "makerSeat"), num(f, "makerKind"), lots, price, ts);
    await tx`
      INSERT INTO idx_candles (market, bucket_sec, open_ticks, high_ticks, low_ticks, close_ticks, volume_lots, trades)
      VALUES (${market}, ${bucket}::bigint, ${Number(price)}, ${Number(price)}, ${Number(price)}, ${Number(price)}, ${String(lots)}::numeric, 1)
      ON CONFLICT (market, bucket_sec) DO UPDATE SET high_ticks = GREATEST(idx_candles.high_ticks, EXCLUDED.high_ticks),
        low_ticks = LEAST(idx_candles.low_ticks, EXCLUDED.low_ticks), close_ticks = EXCLUDED.close_ticks,
        volume_lots = idx_candles.volume_lots + EXCLUDED.volume_lots, trades = idx_candles.trades + 1`;
    await tx`
      UPDATE idx_markets SET volume_lots = volume_lots + ${String(lots)}::numeric, volume_ticklots = volume_ticklots + ${String(lots * price)}::numeric,
        trade_count = trade_count + 1, last_price_ticks = ${Number(price)}, last_trade_sec = ${ts}::bigint
      WHERE market = ${market}`;
  }
  for (const r of list(d, "removed")) await closeOrder(tx, e, r);
  await tx`UPDATE idx_markets SET backing_lots = ${str(d, "backingLots")}::numeric WHERE market = ${market}`;
}

async function windowOpened(tx: Tx, e: IdxEvent) {
  const d = e.data;
  await tx`
    UPDATE idx_markets m SET series = ${str(d, "series")}, market_index = ${str(d, "index")}::bigint, trading_start_sec = ${str(d, "tradingStart")}::bigint,
      lock_at_sec = ${str(d, "lockAt")}::bigint, expiry_sec = ${str(d, "expiry")}::bigint, open_deadline_sec = ${str(d, "openDeadline")}::bigint,
      close_deadline_sec = ${str(d, "closeDeadline")}::bigint, policy_version = ${num(d, "policyVersion")}, open_kind = ${num(d, "openKind")},
      close_kind = ${num(d, "closeKind")}, basis = ${num(d, "basis")}, book = ${str(d, "book")}, ledger = ${str(d, "ledger")}, mvault = ${str(d, "mvault")},
      generation = ${str(d, "generation")}::bigint, opened_signature = ${e.signature}, opened_block_time_sec = ${e.blockTimeSec},
      symbol = (SELECT symbol FROM idx_series WHERE series = ${str(d, "series")}), cadence_sec = (SELECT cadence_sec FROM idx_series WHERE series = ${str(d, "series")})
    WHERE m.market = ${e.market}`;
}

async function positionSet(tx: Tx, e: IdxEvent) {
  const d = e.data;
  const lots = str(d, "lots");
  const minted = bool(d, "minted");
  const sign = minted ? "" : "-";
  await tx`
    INSERT INTO idx_positions (market, owner, seat, yes_lots, no_lots, minted_lots, merged_lots, set_paid_base, set_received_base, first_ts_sec, last_ts_sec, entry_signature, last_signature)
    VALUES (${e.market}, ${str(d, "owner")}, ${num(d, "seat")}, ${sign + lots}::numeric, ${sign + lots}::numeric, ${minted ? lots : "0"}::numeric,
      ${minted ? "0" : lots}::numeric, ${minted ? str(d, "cash") : "0"}::numeric, ${minted ? "0" : str(d, "cash")}::numeric, ${e.blockTimeSec}, ${e.blockTimeSec},
      ${e.signature}, ${e.signature})
    ON CONFLICT (market, owner) DO UPDATE SET seat = EXCLUDED.seat, yes_lots = idx_positions.yes_lots + EXCLUDED.yes_lots, no_lots = idx_positions.no_lots + EXCLUDED.no_lots,
      minted_lots = idx_positions.minted_lots + EXCLUDED.minted_lots, merged_lots = idx_positions.merged_lots + EXCLUDED.merged_lots,
      set_paid_base = idx_positions.set_paid_base + EXCLUDED.set_paid_base, set_received_base = idx_positions.set_received_base + EXCLUDED.set_received_base,
      first_ts_sec = COALESCE(idx_positions.first_ts_sec, EXCLUDED.first_ts_sec), last_ts_sec = EXCLUDED.last_ts_sec,
      entry_signature = COALESCE(idx_positions.entry_signature, EXCLUDED.entry_signature), last_signature = EXCLUDED.last_signature`;
  await tx`UPDATE idx_markets SET backing_lots = ${str(d, "backingLots")}::numeric WHERE market = ${e.market}`;
}

async function redeemed(tx: Tx, e: IdxEvent) {
  const d = e.data;
  const partial = bool(d, "partial");
  await tx`
    INSERT INTO idx_positions (market, owner, seat, redeemed_base, payout_base, bond_refund_base, redeemed, redeemed_by_crank, last_ts_sec, last_signature)
    VALUES (${e.market}, ${str(d, "owner")}, ${num(d, "seat")}, ${str(d, "total")}::numeric, ${str(d, "payout")}::numeric, ${str(d, "bond")}::numeric,
      ${!partial}, ${bool(d, "byCrank")}, ${e.blockTimeSec}, ${e.signature})
    ON CONFLICT (market, owner) DO UPDATE SET
      yes_lots = idx_positions.yes_lots - ${str(d, "yesLots")}::numeric, no_lots = idx_positions.no_lots - ${str(d, "noLots")}::numeric,
      redeemed_base = idx_positions.redeemed_base + EXCLUDED.redeemed_base, payout_base = idx_positions.payout_base + EXCLUDED.payout_base,
      bond_refund_base = idx_positions.bond_refund_base + EXCLUDED.bond_refund_base, redeemed = idx_positions.redeemed OR EXCLUDED.redeemed,
      redeemed_by_crank = idx_positions.redeemed_by_crank OR EXCLUDED.redeemed_by_crank, last_ts_sec = EXCLUDED.last_ts_sec, last_signature = EXCLUDED.last_signature`;
}

/** Applies one Market-scoped event's projections. Unknown names are stored raw only. */
export async function applyEvent(tx: Tx, e: IdxEvent): Promise<void> {
  if (!e.market || e.seq === null) return;
  await tx`
    INSERT INTO idx_markets (market, last_seq, last_slot) VALUES (${e.market}, ${e.seq}::bigint, ${e.slot})
    ON CONFLICT (market) DO UPDATE SET last_seq = GREATEST(idx_markets.last_seq, EXCLUDED.last_seq), last_slot = GREATEST(idx_markets.last_slot, EXCLUDED.last_slot)`;
  const d = e.data;
  switch (e.name) {
    case "WindowOpened":
      return windowOpened(tx, e);
    case "PrintRecorded":
      await tx`
        INSERT INTO idx_prints (market, which, source, price, expo, source_ts_sec, signers, copied, recorded_ts_sec, signature)
        VALUES (${e.market}, ${num(d, "which")}, ${num(d, "source")}, ${str(d, "price")}::numeric, ${num(d, "expo")}, ${str(d, "sourceTs")}::bigint,
          ${num(d, "signers")}, ${bool(d, "copied")}, ${str(d, "recordedTs")}::bigint, ${e.signature})
        ON CONFLICT (market, which) DO NOTHING`;
      return;
    case "OrderExecuted":
      return orderExecuted(tx, e);
    case "OrdersCancelled":
      for (const r of list(d, "removed")) await closeOrder(tx, e, r);
      return;
    case "OrderReduced": {
      const h = d.handle as Data;
      await tx`
        UPDATE idx_orders SET remaining_lots = ${str(d, "newLots")}::numeric, updated_seq = ${e.seq}::bigint
        WHERE market = ${e.market} AND rested_node = ${num(h, "node")} AND rested_seq = ${str(h, "seq")}::numeric AND status = 'open'`;
      return;
    }
    case "CompleteSet":
      return positionSet(tx, e);
    case "CreditWithdrawn":
      await tx`
        INSERT INTO idx_positions (market, owner, seat, withdrawn_base, last_ts_sec, last_signature)
        VALUES (${e.market}, ${str(d, "owner")}, ${num(d, "seat")}, ${str(d, "amount")}::numeric, ${e.blockTimeSec}, ${e.signature})
        ON CONFLICT (market, owner) DO UPDATE SET withdrawn_base = idx_positions.withdrawn_base + EXCLUDED.withdrawn_base`;
      return;
    case "WindowResolved":
      await tx`
        UPDATE idx_markets SET state = ${num(d, "state") === 1 ? "resolved" : "voided"}, winner = ${num(d, "winner")}, payout_yes = ${num(d, "payoutYes")},
          payout_no = ${num(d, "payoutNo")}, void_reason = ${num(d, "voidReason")}, single_source = ${bool(d, "singleSource")},
          resolved_ts_sec = ${str(d, "resolvedTs")}::bigint, resolved_signature = ${e.signature}
        WHERE market = ${e.market}`;
      return;
    case "Redeemed":
      return redeemed(tx, e);
    case "BookReleased":
      await tx`UPDATE idx_markets SET book_released = true WHERE market = ${e.market}`;
      return;
    case "LedgerGrown":
      await tx`UPDATE idx_markets SET ledger_capacity = ${num(d, "capacity")} WHERE market = ${e.market}`;
      return;
    case "LedgerClosed":
      await tx`UPDATE idx_markets SET ledger_closed = true, ledger_residue_base = ${str(d, "residue")}::numeric WHERE market = ${e.market}`;
      return;
    case "DependentChanged":
      await tx`UPDATE idx_markets SET dependents = ${num(d, "dependents")} WHERE market = ${e.market}`;
      return;
    case "MarketClosed":
      await tx`UPDATE idx_markets SET closed = true WHERE market = ${e.market}`;
      return;
  }
}
