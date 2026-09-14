/**
 * The indexer read client (`/api/index/*`, first-call.md §5). Identical requests share one in-flight fetch and its
 * answer for a second, so the several reads a surface mounts together (positions for holdings, claimables and the
 * balance sheet) cost one round trip. Every failure to reach it is `indexer-down`, the retryable outage kind.
 */
import { diagnosis } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";
import { peekClient } from "../runtime/read-runtime";

/** A u64/i64/NUMERIC column, as the API sends it. */
export type Dec = string;

export interface PrintJson {
  source: number;
  price: Dec;
  expo: number;
  sourceTsSec: number;
  signers: number;
  copied: boolean;
  signature: string;
}

export interface MarketRow {
  market: string;
  series: string | null;
  symbol: string | null;
  cadence_sec: number | null;
  basis: number | null;
  market_index: Dec | null;
  trading_start_sec: Dec | null;
  lock_at_sec: Dec | null;
  expiry_sec: Dec | null;
  policy_version: number | null;
  book: string | null;
  ledger: string | null;
  state: "open" | "resolved" | "voided";
  winner: number | null;
  payout_yes: Dec | null;
  payout_no: Dec | null;
  void_reason: number | null;
  single_source: boolean | null;
  resolved_ts_sec: Dec | null;
  resolved_signature: string | null;
  backing_lots: Dec;
  volume_ticklots: Dec;
  trade_count: Dec;
  last_price_ticks: number | null;
  lot_base: Dec | null;
  tick_base: Dec | null;
  cash_unit: Dec | null;
  /** Keyed by `which`: 0 open, 1 close, 2 check open, 3 check close. */
  prints: Record<string, PrintJson> | null;
}

export interface PositionRow {
  market: string;
  owner: string;
  seat: number | null;
  yes_lots: Dec;
  no_lots: Dec;
  bought_yes_lots: Dec;
  sold_yes_lots: Dec;
  bought_no_lots: Dec;
  sold_no_lots: Dec;
  paid_ticklots: Dec;
  received_ticklots: Dec;
  minted_lots: Dec;
  merged_lots: Dec;
  set_paid_base: Dec;
  set_received_base: Dec;
  payout_base: Dec;
  redeemed: boolean;
  redeemed_by_crank: boolean;
  fills: number;
  symbol: string | null;
  cadence_sec: number | null;
  expiry_sec: Dec | null;
  lock_at_sec: Dec | null;
  trading_start_sec: Dec | null;
  state: "open" | "resolved" | "voided";
  winner: number | null;
  void_reason: number | null;
  resolved_ts_sec: Dec | null;
  cash_unit: Dec | null;
  lot_base: Dec | null;
  tick_base: Dec | null;
  last_price_ticks: number | null;
  series: string | null;
  ledger: string | null;
}

export interface FillRow {
  signature: string;
  fill_ix: number;
  market: string;
  book: string | null;
  seq: Dec;
  ts_sec: Dec;
  taker: string;
  taker_kind: number;
  maker: string;
  maker_kind: number;
  price_ticks: number;
  lots: Dec;
}

export interface ActionRow {
  signature: string;
  name: "CompleteSet" | "Redeemed" | "CreditWithdrawn";
  market: string | null;
  block_time_sec: Dec | null;
  data: Record<string, unknown>;
}

export interface PrintHistoryRow {
  source_ts_sec: Dec;
  source: number;
  price: Dec;
  expo: number;
}

const MEMO_MS = 1_000;
/** Never cached by the browser or Next's server fetch cache (a variable: Node's `RequestInit` type lacks `cache`). */
export const NO_STORE = { cache: "no-store" } as const;
/** `doneAtMs` null while in flight: a request is shared for as long as it runs, then its answer for `MEMO_MS`. */
const inflight = new Map<string, { doneAtMs: number | null; rows: Promise<unknown[]> }>();

const indexerDown = (technical: string) => new ReadingError(diagnosis("indexer-down", technical));

async function request<T>(url: string): Promise<T[]> {
  let response: Response;
  try {
    response = await fetch(url, { ...NO_STORE, headers: { accept: "application/json" } });
  } catch (error) {
    throw indexerDown(`indexer unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw indexerDown(`indexer ${response.status}: ${body?.error ?? response.statusText}`);
  }
  return ((await response.json()) as { rows: T[] }).rows;
}

/** GET `<indexer>/<path>?<query>` → rows. Undefined query values are dropped. */
export function indexRows<T>(path: string, query: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const base = peekClient()?.indexerUrl;
  if (!base) return Promise.reject(indexerDown("no indexer configured (NEXT_PUBLIC_AGARI_INDEXER_URL)"));
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  const search = params.toString() ? `?${params}` : "";
  const url = `${base.replace(/\/$/, "")}/${path}${search}`;
  const now = Date.now();
  const hit = inflight.get(url);
  if (hit && (hit.doneAtMs === null || now - hit.doneAtMs < MEMO_MS)) return hit.rows as Promise<T[]>;
  const entry: { doneAtMs: number | null; rows: Promise<unknown[]> } = { doneAtMs: null, rows: request<T>(url) };
  inflight.set(url, entry);
  entry.rows.then(
    () => void (entry.doneAtMs = Date.now()),
    () => inflight.get(url) === entry && inflight.delete(url),
  );
  if (inflight.size > 256) for (const [key, e] of inflight) if (e.doneAtMs !== null && now - e.doneAtMs >= MEMO_MS) inflight.delete(key);
  const rows = entry.rows as Promise<T[]>;
  return rows;
}

export const big = (value: Dec | null | undefined): bigint => (value === null || value === undefined ? 0n : BigInt(value));
export const bigOrNull = (value: Dec | null | undefined): bigint | null => (value === null || value === undefined ? null : BigInt(value));
/** Seconds columns fit a JS number exactly (i64 seconds < 2^53). */
export const sec = (value: Dec | number | null | undefined): number => (value === null || value === undefined ? 0 : Number(value));
