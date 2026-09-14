import type { Address, MarketId, Signature } from "@agari/core/types";
import type { Signature as KitSignature } from "@solana/kit";
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

type IdxRow = Record<string, unknown>;

/** How many recent Ledger transactions the chain fallback reads before giving up (each is one `getTransaction`). */
const LEDGER_SCAN = 10;

async function indexRows(base: string, path: string): Promise<IdxRow[] | null> {
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/${path}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { rows?: unknown };
    return Array.isArray(body.rows) ? (body.rows as IdxRow[]) : null;
  } catch {
    return null;
  }
}

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

/** The indexer API (`/api/index/*`, first-call.md §5), with the Ledger's history as the fallback for redeems. */
export function indexEvidence(indexerUrl: string | undefined, rpc: WriteRpc): WriteEvidence {
  return {
    async filledSince(wallet, marketId, sinceSec) {
      if (!indexerUrl) return null;
      const rows = await indexRows(indexerUrl, `wallet/${wallet}/fills?market=${marketId}&since=${sinceSec}&limit=1`);
      return rows === null ? null : rows.length > 0;
    },
    async redeemedBy(wallet, marketId, ledger) {
      const rows = indexerUrl ? await indexRows(indexerUrl, `wallet/${wallet}/actions?limit=200`) : null;
      const row = rows?.find((r) => r.name === "Redeemed" && r.market === marketId && typeof r.signature === "string");
      if (row) return row.signature as Signature;
      return redeemedOnChain(rpc, wallet, marketId, ledger);
    },
  };
}
