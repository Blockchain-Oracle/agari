import { diagnosis, type Address, type Diagnosis, type OnchainSnapshot, type Quote } from "@agari/core/types";
import { diagnose } from "../errors/error-map";
import { readSeat, readTokenBalance } from "../runtime/accounts";
import { solana } from "../runtime/solana";
import { checkGas } from "./fees";
import type { WriteRpc } from "./steps/message";

/**
 * Whether an order's escrow is covered. The engine draws the seat's credit first and the wallet's token account second
 * (credit-first funding, `events-engine.md` §4.1); a wallet's first order in a Window also pays the seat bond, refunded
 * at redeem. There is no token approval on Solana.
 */
export type FundingCheck =
  | {
      ok: true;
      venueCreditUsedBase: bigint;
      walletSpendBase: bigint;
      /** The seat bond this order pays (0 once the wallet holds a seat on the Window). */
      bondBase: bigint;
      /** The wallet's seat on this Window's Ledger, or null when this order claims one. */
      seatIndex: number | null;
    }
  | { ok: false; diagnosis: Diagnosis };

/**
 * `need = maxCost + bond − min(credit, maxCost + bond)` must fit the ATA balance, and the SOL balance must cover the
 * fee (first-call.md §3.1). The ticket runs the same check before the wallet opens; the order lane re-runs it at send.
 */
export async function assertFunded(wallet: Address, onchain: OnchainSnapshot, quote: Quote, rpc: WriteRpc = solana().rpc): Promise<FundingCheck> {
  try {
    const [seatRead, token, gas] = await Promise.all([
      readSeat(onchain.ledger, wallet),
      readTokenBalance(wallet, onchain.collateral),
      checkGas(rpc, wallet, "order"),
    ]);
    if (!gas.ok) return { ok: false, diagnosis: gas.diagnosis };
    if (!seatRead) return { ok: false, diagnosis: diagnosis("market-not-trading", `the Window's Ledger ${onchain.ledger} is closed`) };

    const { seat, seatBond } = seatRead;
    const bondBase = seat ? 0n : seatBond;
    const escrowBase = quote.maxCostBase + bondBase;
    const credit = seat?.credit ?? 0n;
    const venueCreditUsedBase = credit < escrowBase ? credit : escrowBase;
    const walletSpendBase = escrowBase - venueCreditUsedBase;
    const balanceBase = token.amountBase ?? 0n;
    if (balanceBase < walletSpendBase) {
      return {
        ok: false,
        diagnosis: diagnosis("insufficient-collateral", `wallet holds ${balanceBase} but the order needs ${walletSpendBase} after venue credit (bond ${bondBase})`),
      };
    }
    return { ok: true, venueCreditUsedBase, walletSpendBase, bondBase, seatIndex: seat?.index ?? null };
  } catch (error) {
    return { ok: false, diagnosis: diagnose(error) };
  }
}
