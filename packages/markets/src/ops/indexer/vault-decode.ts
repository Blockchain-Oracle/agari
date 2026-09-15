/**
 * agari-vault event decode for the indexer (tap-trading.md §1.1, D-068): the same `emit_cpi!` rule as the engine's
 * decoder (`decode.ts`), over the vault program and its event authority. Rows leave JSON-safe (bigints as decimal
 * strings) for `idx_vault_fills` / `idx_vault_settlements`; a failed transaction yields none.
 */
import { AGARI_VAULT_PROGRAM_ADDRESS } from "@agari/clients/agari-vault";
import { vaultEventAuthority } from "../../vault/accounts";
import { decodeVaultEventsLocated, type VaultEventName } from "../../vault/events";
import type { JsonSafe } from "./events";
import { toJsonSafe } from "./events";
import type { RawTransaction } from "./decode";

export const AGARI_VAULT_PROGRAM_ID: string = AGARI_VAULT_PROGRAM_ADDRESS;

export interface DecodedVaultEvent {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  outerIx: number;
  innerIx: number;
  name: VaultEventName;
  /** The Trading Balance the event belongs to (every vault event but `VaultInitialized` names one). */
  owner: string | null;
  market: string | null;
  data: { [key: string]: JsonSafe };
}

export interface DecodedVaultTransaction {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  failed: boolean;
  events: DecodedVaultEvent[];
}

/** The vault's event authority (`["__event_authority"]` under agari-vault), for the log subscription's filter. */
export const vaultEventAuthorityOf = (): Promise<string> => vaultEventAuthority();

export async function decodeVaultTransactionEvents(tx: RawTransaction): Promise<DecodedVaultTransaction> {
  const signature = tx.transaction.signatures[0]!;
  const base = { signature, slot: Number(tx.slot), blockTimeSec: tx.blockTime === null ? null : Number(tx.blockTime) };
  const failed = tx.meta === null || tx.meta.err !== null;
  if (failed) return { ...base, failed, events: [] };
  const located = await decodeVaultEventsLocated(tx);
  const events = located.map(({ outerIx, innerIx, event }) => {
    const data = toJsonSafe(event.data) as { [key: string]: JsonSafe };
    return {
      ...base,
      outerIx,
      innerIx,
      name: event.name,
      owner: typeof data.owner === "string" ? data.owner : null,
      market: typeof data.market === "string" ? data.market : null,
      data,
    };
  });
  return { ...base, failed, events };
}
