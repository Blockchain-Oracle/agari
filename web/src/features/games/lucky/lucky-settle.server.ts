import { luckyBestStreak, luckyStreak, luckyVerdict, type LuckyResult } from "@masayume/core/games";
import { buildLedgers, type LedgerFill, type MarketLedger } from "@masayume/core/projection";
import { isOk } from "@masayume/core/schemas";
import { toMarketId, type Address, type Bytes32, type EventMarket, type Hex } from "@masayume/core/types";
import {
  gamesStoreConfigured,
  getLuckyDraw,
  listLuckyDrawsFor,
  listLuckyOpenFor,
  listLuckyVerified,
  recordLuckyPlacement,
  recordLuckyResult,
  type LuckyDrawRow,
} from "@masayume/db";
import { ensureMarkets, listWalletFills, marketsProvider } from "@masayume/markets";
import { marketsEnvFromProcess } from "@/features/session/sponsor.server";
import type { LuckyBoardWire, LuckyHistoryWire, LuckyPlacedStatus, LuckyPlacedWire, LuckyRowWire } from "./lucky-wire";

/**
 * Everything after the signature — server only. Nothing here may be imported by a component.
 *
 * The rule: a browser reports what the Ticket lane told it, and the server believes none of it about
 * money. `confirmed` is checked against the wallet's own fills for that transaction; the quantity and
 * cost recorded are what the tape measured, never what the quote promised. A verdict comes from the
 * Window's own settlement, read from the chain when a history is asked for; a cash-out is what the
 * ledger says the wallet did on the book before that. Streaks and the board count only those rows.
 */

/** A fill that landed seconds before the report's clock is still that report's fill: the tape's stamp, not ours. */
const FILL_LOOKBACK_SEC = 900;
const BOARD_LIMIT = 20;
const HISTORY_LIMIT = 50;

export type PlacedOutcome = { ok: true; wire: LuckyPlacedWire } | { ok: false; status: number; error: string };

interface Measured {
  costBase: bigint;
  quantityRaw: bigint;
}

function heldOn(ledger: MarketLedger, side: "up" | "down"): bigint {
  return side === "up" ? ledger.heldUpRaw : ledger.heldDownRaw;
}

/** What the wallet's fills for one transaction on one Window add up to, or null when the tape has none yet. */
async function measureFill(row: LuckyDrawRow, market: EventMarket): Promise<Measured | null> {
  if (!row.txHash || !row.side) return null;
  const since = Math.floor((row.placedAtMs ?? row.createdAtMs) / 1_000) - FILL_LOOKBACK_SEC;
  const fills = await listWalletFills(row.wallet as Address, { pool: market.poolAddress, sinceSec: since });
  if (!isOk(fills)) return null;
  const mine = fills.value.filter((f) => f.txHash.toLowerCase() === row.txHash && f.marketId === market.marketId);
  if (mine.length === 0) return null;
  const ledger = buildLedgers(mine, [], market.decimals).get(market.marketId);
  if (!ledger) return null;
  return { costBase: ledger.costBase, quantityRaw: heldOn(ledger, row.side) };
}

/** The wallet's whole ledger on the Window — what it still holds, and what it took off the book before expiry. */
async function ledgerOn(row: LuckyDrawRow, market: EventMarket): Promise<MarketLedger | null> {
  const fills = await listWalletFills(row.wallet as Address, { pool: market.poolAddress, sinceSec: Math.floor(row.createdAtMs / 1_000) - FILL_LOOKBACK_SEC });
  if (!isOk(fills)) return null;
  const mine: LedgerFill[] = fills.value.filter((f) => f.marketId === market.marketId);
  return buildLedgers(mine, [], market.decimals).get(market.marketId) ?? null;
}

const settled = (m: EventMarket) => m.status === "Resolved" || m.status === "Finalized" || m.status === "Voided" || m.voided;

async function marketOf(row: LuckyDrawRow): Promise<EventMarket | null> {
  if (!row.marketId) return null;
  const reading = await marketsProvider.getMarket(toMarketId(row.marketId));
  return isOk(reading) ? reading.value : null;
}

/** The browser's report of the Ticket lane's outcome, turned into the row's next honest state. */
export async function confirmPlacement(input: { drawId: Bytes32; status: LuckyPlacedStatus; txHash: Hex | null }): Promise<PlacedOutcome> {
  const row = await getLuckyDraw(input.drawId);
  if (!row) return { ok: false, status: 404, error: "no draw by that id" };
  if (row.result !== "drawn") return { ok: false, status: 409, error: `that draw is already ${row.result}` };
  if (!row.marketId || !row.side) return { ok: false, status: 409, error: "that draw was never dealt a Window" };
  ensureMarkets(marketsEnvFromProcess());

  const hash = input.txHash ? (input.txHash.toLowerCase() as Hex) : null;
  let wire: LuckyPlacedWire;
  switch (input.status) {
    case "confirmed": {
      if (!hash) return { ok: false, status: 400, error: "a confirmed order names its transaction" };
      const market = await marketOf(row);
      const measured = market ? await measureFill({ ...row, txHash: hash, placedAtMs: Date.now() }, market) : null;
      wire = measured
        ? { result: "pending", refusal: null, txHash: hash, costBase: measured.costBase.toString(), quantityRaw: measured.quantityRaw.toString() }
        : { result: "unknown", refusal: "not-on-tape-yet", txHash: hash, costBase: null, quantityRaw: null };
      break;
    }
    case "nothingFilled":
      wire = { result: "refused", refusal: "nothing-filled", txHash: hash, costBase: null, quantityRaw: null };
      break;
    case "reverted":
      wire = { result: "refused", refusal: "reverted", txHash: hash, costBase: null, quantityRaw: null };
      break;
    case "refused":
      wire = { result: "refused", refusal: "lane-refused", txHash: null, costBase: null, quantityRaw: null };
      break;
    case "declined":
      wire = { result: "refused", refusal: "declined", txHash: null, costBase: null, quantityRaw: null };
      break;
    case "unknown":
      wire = { result: "unknown", refusal: "send-timed-out", txHash: hash, costBase: null, quantityRaw: null };
      break;
  }
  await recordLuckyPlacement(row.drawId, { result: wire.result as "pending" | "refused" | "unknown", txHash: wire.txHash, costBase: wire.costBase, quantityRaw: wire.quantityRaw, refusal: wire.refusal });
  return { ok: true, wire };
}

/**
 * Every open row of a wallet, re-read against the chain: an `unknown` send is looked for on the tape; a
 * `pending` fill is checked for a cash-out and, once its Window settles, for the verdict. Lazy, on the
 * history read, so nothing here needs a worker — and nothing here is a guess: a row that cannot be
 * decided today stays what it was.
 */
export async function reconcileDraws(wallet: Address): Promise<void> {
  ensureMarkets(marketsEnvFromProcess());
  for (const row of await listLuckyOpenFor(wallet)) {
    const market = await marketOf(row);
    if (!market || !row.side) continue;

    if (row.result === "unknown" || row.result === "placed") {
      const measured = row.txHash ? await measureFill(row, market) : null;
      if (measured) {
        await recordLuckyPlacement(row.drawId, { result: "pending", txHash: row.txHash, costBase: measured.costBase.toString(), quantityRaw: measured.quantityRaw.toString(), refusal: null });
      } else if (settled(market)) {
        await recordLuckyResult(row.drawId, "refused", "nothing-filled");
      }
      continue;
    }

    const ledger = await ledgerOn(row, market);
    if (!ledger) continue;
    const cashedOut = heldOn(ledger, row.side) === 0n && ledger.proceedsBase > 0n;
    if (cashedOut) {
      await recordLuckyResult(row.drawId, "cashed-out");
      continue;
    }
    if (!settled(market)) continue;
    const resolution = await marketsProvider.getResolution(market.marketId);
    const voided = market.voided || (isOk(resolution) && resolution.value.voided);
    await recordLuckyResult(row.drawId, luckyVerdict(row.side, market.winningOutcome, voided));
  }
}

const toWire = (row: LuckyDrawRow): LuckyRowWire => ({
  drawId: row.drawId as Bytes32,
  nonce: row.nonce,
  asset: row.asset,
  side: row.side,
  multiplier: row.multiplier,
  marketId: row.marketId as Bytes32 | null,
  quoteAvgPriceBps: row.quoteAvgPriceBps,
  txHash: row.txHash as Hex | null,
  stakeBase: row.stakeBase,
  costBase: row.costBase,
  quantityRaw: row.quantityRaw,
  result: row.result as LuckyResult,
  refusal: row.refusal,
  createdAtMs: row.createdAtMs,
  settledAtMs: row.settledAtMs,
});

/** A wallet's spins, newest first, reconciled first — and the streak the verified ones add up to. */
export async function luckyHistory(wallet: Address): Promise<LuckyHistoryWire> {
  if (!gamesStoreConfigured()) return { configured: false, rows: [], streak: 0, best: 0 };
  await reconcileDraws(wallet).catch(() => undefined);
  const rows = await listLuckyDrawsFor(wallet, HISTORY_LIMIT);
  const results = rows.map((r) => ({ result: r.result as LuckyResult }));
  return { configured: true, rows: rows.map(toWire), streak: luckyStreak(results), best: luckyBestStreak([...results].reverse()) };
}

/** The ladder of current streaks, best as the tiebreak — over settled spins only, by core's own rule. */
export async function luckyBoard(): Promise<LuckyBoardWire> {
  if (!gamesStoreConfigured()) return { configured: false, rows: [] };
  const verified = await listLuckyVerified();
  const byWallet = new Map<string, { result: LuckyResult }[]>();
  for (const row of verified) {
    const list = byWallet.get(row.wallet) ?? [];
    list.push({ result: row.result });
    byWallet.set(row.wallet, list);
  }
  const rows = [...byWallet.entries()]
    .map(([wallet, list]) => ({ wallet: wallet as Address, streak: luckyStreak(list), best: luckyBestStreak([...list].reverse()), spins: list.length }))
    .filter((r) => r.best > 0)
    .sort((a, b) => b.streak - a.streak || b.best - a.best || b.spins - a.spins || a.wallet.localeCompare(b.wallet))
    .slice(0, BOARD_LIMIT);
  return { configured: true, rows };
}
