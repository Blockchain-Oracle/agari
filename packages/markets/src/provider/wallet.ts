/**
 * A wallet's money (first-call.md §2.2): open positions and claimables discovered from the wallet's own index rows
 * (never a venue scan), then the head-fresh truth from chain in one batched account read: SOL, the tUSDC ATA and
 * the Ledger seats of the Windows it still has something in.
 */
import { enumerateClaimables, type SettledHolding } from "@agari/core/claims";
import type { Reading } from "@agari/core/schemas";
import type { Address, BalanceSheet, ClaimableRow, MarketId, OpenPosition, VenueCredit } from "@agari/core/types";
import { oneUnit } from "@agari/core/units";
import type { Address as KitAddress } from "@solana/kit";
import { loadAccount, loadAccounts } from "../runtime/account-loader";
import { readTokenBalance, readVenueStatic } from "../runtime/accounts";
import { findSeat, type LedgerSeat } from "../runtime/decode";
import { loadCollateral } from "../collateral";
import { readVaultAccount } from "../vault/accounts";
import { loadVaultDeployment } from "../vault/deployment";
import { big, indexRows, sec, type PositionRow } from "./index-api";
import { withReading } from "./reading";
import { positionMarket } from "./rows";

const PAIR_TICKS = 1000n;
/** The balance sheet reads at most this many Ledgers per poll (spec: ≤ 10 unredeemed Windows). */
const MAX_CREDIT_LEDGERS = 10;

/** The wallet's position rows on registry tickers: a drive-only Series (no symbol) is never a user surface. */
const positionsOf = async (wallet: Address, unredeemed = false) =>
  (await indexRows<PositionRow>(`wallet/${wallet}/positions`, unredeemed ? { unredeemed: 1 } : {})).filter((row) => row.symbol !== null);
const kit = (value: string) => value as KitAddress;

/** Seats of `wallet` in each row's Ledger, in one batch; null where the Ledger is closed or holds no seat. */
async function seatsIn(wallet: Address, rows: readonly PositionRow[]): Promise<(LedgerSeat | null)[]> {
  const withLedger = rows.map((row) => row.ledger);
  const accounts = await loadAccounts(withLedger.filter((l): l is string => l !== null).map(kit));
  let cursor = 0;
  return withLedger.map((ledger) => {
    if (ledger === null) return null;
    const bytes = accounts[cursor++]?.bytes;
    return bytes ? findSeat(bytes, kit(wallet)) : null;
  });
}

export async function listOpenPositions(wallet: Address): Promise<Reading<OpenPosition[]>> {
  return withReading(`positions:${wallet}`, async () => {
    const [rows, venue] = await Promise.all([positionsOf(wallet), readVenueStatic()]);
    const one = oneUnit(venue.decimals);
    return rows
      .filter((row) => row.state === "open" && big(row.yes_lots) + big(row.no_lots) > 0n)
      .map((row) => {
        const lotBase = big(row.lot_base);
        const cashUnit = big(row.cash_unit);
        const upRaw = big(row.yes_lots) * lotBase;
        const downRaw = big(row.no_lots) * lotBase;
        const costBasisBase = big(row.paid_ticklots) * cashUnit + big(row.set_paid_base);
        const realizedPnlBase = big(row.received_ticklots) * cashUnit + big(row.set_received_base);
        const last = row.last_price_ticks === null ? null : BigInt(row.last_price_ticks);
        // Held lots at the last trade, each side in its own terms: YES at p, NO at 1000 − p (lots × ticks × cash unit).
        const markValueBase = last === null ? 0n : (big(row.yes_lots) * last + big(row.no_lots) * (PAIR_TICKS - last)) * cashUnit;
        const heldRaw = upRaw + downRaw;
        return {
          marketId: row.market as MarketId,
          asset: row.symbol ?? "",
          intervalSec: row.cadence_sec ?? 0,
          expirySec: sec(row.expiry_sec),
          decimals: venue.decimals,
          balanceUpRaw: upRaw,
          balanceDownRaw: downRaw,
          costBasisBase,
          avgCostRaw: heldRaw > 0n ? (costBasisBase * one) / heldRaw : 0n,
          markValueBase,
          unrealizedPnlBase: markValueBase + realizedPnlBase - costBasisBase,
          realizedPnlBase,
        };
      });
  });
}

/** Terminal Windows the wallet hasn't redeemed, checked against its live seat: a seat already paid is no row. */
export async function listClaimables(wallet: Address, venueId: Address): Promise<Reading<ClaimableRow[]>> {
  return withReading(`claimables:${wallet}:${venueId}`, async () => {
    const [rows, venue] = await Promise.all([positionsOf(wallet, true), readVenueStatic()]);
    const terminal = rows.filter((row) => row.state !== "open");
    if (terminal.length === 0) return [];
    const seats = await seatsIn(wallet, terminal);
    const settled: SettledHolding[] = [];
    terminal.forEach((row, i) => {
      const seat = seats[i];
      if (!seat) return;
      const lotBase = big(row.lot_base);
      settled.push({
        market: positionMarket(row, venue.decimals),
        holdings: { upRaw: (seat.yesFree + seat.yesLocked) * lotBase, downRaw: (seat.noFree + seat.noLocked) * lotBase },
        feeBps: 0,
      });
    });
    return enumerateClaimables(settled);
  });
}

/** The Trading Balance's free `available` (Masayume `balances.ts:64`): null without a vault, 0 before an account opens. */
async function vaultAvailable(wallet: Address): Promise<bigint | null> {
  if (!(await loadVaultDeployment())) return null;
  return (await readVaultAccount(wallet))?.available ?? 0n;
}

/** Every pool of money labelled separately (FR-5): wallet tUSDC, SOL, cash locked by resting orders, seat credit, the Trading Balance. */
export async function getBalanceSheet(wallet: Address): Promise<Reading<BalanceSheet>> {
  return withReading(`balances:${wallet}`, async () => {
    const [rows, venue] = await Promise.all([positionsOf(wallet, true), readVenueStatic()]);
    // Open Windows first: their seats hold live escrow; a terminal Ledger is usually already closed.
    const credited = rows
      .filter((row) => row.ledger !== null)
      .sort((a, b) => Number(b.state === "open") - Number(a.state === "open"))
      .slice(0, MAX_CREDIT_LEDGERS);
    // Index first, then one batch: the wallet, its ATA and every Ledger join the same getMultipleAccounts.
    const [native, token, seats, vaultBase] = await Promise.all([
      loadAccount(kit(wallet)),
      readTokenBalance(wallet, venue.collateralMint),
      seatsIn(wallet, credited),
      vaultAvailable(wallet),
    ]);
    const credits: VenueCredit[] = [];
    let orderEscrowBase = 0n;
    credited.forEach((row, i) => {
      const seat = seats[i];
      if (!seat) return;
      orderEscrowBase += seat.lockedCash;
      if (seat.credit > 0n) credits.push({ marketId: row.market as MarketId, amountBase: seat.credit });
    });
    return {
      decimals: venue.decimals,
      spendableBase: token.amountBase ?? 0n,
      nativeLamports: native.lamports,
      orderEscrowBase,
      venueCreditBase: credits.reduce((sum, credit) => sum + credit.amountBase, 0n),
      venueCreditByMarket: credits,
      vaultBase,
    };
  });
}

/** A wallet's tUSDC balance: the collateral fact and one ATA read, nothing venue-wide. */
export function getWalletCollateral(wallet: Address): Promise<Reading<{ amountBase: bigint; decimals: number; symbol: string }>> {
  return withReading(`wallet-collateral:${wallet}`, async (inner) => {
    const collateral = inner(await loadCollateral());
    const { amountBase } = await readTokenBalance(wallet, collateral.address);
    return { amountBase: amountBase ?? 0n, decimals: collateral.decimals, symbol: collateral.symbol };
  });
}
