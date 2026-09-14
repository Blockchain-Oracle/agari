import type { Address, MarketId, Signature } from "@agari/core/types";
import type { Signature as KitSignature } from "@solana/kit";
import { indexRows, type ActionRow, type FillRow } from "../provider/index-api";
import { fetchWriteEvents } from "./steps/book";
import type { WriteRpc } from "./steps/message";

/**
 * What a write lane asks the record about when the chain's own state no longer says it (first-call.md §3.2, §3.4):
 * whether a journaled order that never got a signature filled anyway, and who redeemed a seat that is gone.
 */
export interface WriteEvidence {
  /** Any fill of the wallet's on the Window at or after `sinceSec`; null when the index can't be asked. */
  filledSince(wallet: Address, marketId: MarketId, sinceSec: number): Promise<boolean | null>;
  /** The signature of the `Redeemed` that paid the wallet's seat on the Window (its own redeem or the settler's crank). */
  redeemedBy(wallet: Address, marketId: MarketId, ledger: Address): Promise<Signature | null>;
}

/** How many recent Ledger transactions the chain fallback reads before giving up (each is one `getTransaction`). */
const LEDGER_SCAN = 10;
/** Actions scanned for a Window's `Redeemed`; a wallet's newest first. */
const ACTIONS_PAGE = 200;

/** A seat paid moments ago may not be indexed yet (lag < 10 s): the Ledger's own recent history answers too. */
async function redeemedOnChain(rpc: WriteRpc, wallet: Address, marketId: MarketId, ledger: Address): Promise<Signature | null> {
  const history = await rpc
    .getSignaturesForAddress(ledger as string as Parameters<WriteRpc["getSignaturesForAddress"]>[0], { limit: LEDGER_SCAN, commitment: "confirmed" })
    .send()
    .catch(() => []);
  for (const entry of history) {
    if (entry.err) continue;
    const events = await fetchWriteEvents(rpc, entry.signature as string as Signature, 1);
    const paid = events?.find((e) => e.name === "Redeemed" && e.data.owner === (wallet as string) && e.data.market === (marketId as string));
    if (paid) return entry.signature as KitSignature as string as Signature;
  }
  return null;
}

/**
 * The indexer API (`/api/index/*`, first-call.md §5, through the runtime's `indexRows`), with the Ledger's history as the
 * fallback for redeems. An unreachable or unconfigured index answers `null` for fills, never "nothing filled".
 */
export function indexEvidence(rpc: WriteRpc): WriteEvidence {
  return {
    async filledSince(wallet, marketId, sinceSec) {
      const rows = await indexRows<FillRow>(`wallet/${wallet}/fills`, { market: marketId, since: sinceSec, limit: 1 }).catch(() => null);
      return rows === null ? null : rows.length > 0;
    },
    async redeemedBy(wallet, marketId, ledger) {
      const rows = await indexRows<ActionRow>(`wallet/${wallet}/actions`, { limit: ACTIONS_PAGE }).catch(() => null);
      const row = rows?.find((r) => r.name === "Redeemed" && r.market === (marketId as string));
      if (row) return row.signature as Signature;
      return redeemedOnChain(rpc, wallet, marketId, ledger);
    },
  };
}
