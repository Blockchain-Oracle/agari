/**
 * Fixed-header reads for the roller's hot loop (events-accounts.md §3.8–3.9): a Book is ≈ 57 KB and a Ledger grows to
 * 90 KB, but the roller needs a few header fields, so these read a `dataSlice` and decode by offset.
 */
import { findConfigPda } from "@agari/clients/agari-events";
import { getAddressDecoder, getBase64Encoder, type Address } from "@solana/kit";
import type { OpsClient } from "../client";

export type BookHeader = { address: Address; market: Address; series: Address; capacity: number; orderCount: number };
export type LedgerHeader = { address: Address; market: Address; rentPayer: Address; capacity: number; seatsUsed: number };

const DEFAULT_ADDRESS = "11111111111111111111111111111111" as Address;
const MULTIPLE_ACCOUNTS_MAX = 100;
const bytesOf = (b64: string) => getBase64Encoder().encode(b64);

async function sliced<T>(client: OpsClient, addresses: readonly Address[], length: number, decode: (address: Address, data: Uint8Array) => T): Promise<Array<T | null>> {
  const out: Array<T | null> = [];
  for (let i = 0; i < addresses.length; i += MULTIPLE_ACCOUNTS_MAX) {
    const chunk = addresses.slice(i, i + MULTIPLE_ACCOUNTS_MAX);
    const { value } = await client.rpc.getMultipleAccounts(chunk, { encoding: "base64", dataSlice: { offset: 0, length } }).send();
    value.forEach((account, j) => out.push(account ? decode(chunk[j]!, new Uint8Array(bytesOf(account.data[0]))) : null));
  }
  return out;
}

const addressAt = (data: Uint8Array, offset: number) => getAddressDecoder().decode(data.subarray(offset, offset + 32));

/** Book: discriminator 8 ‖ market 32 ‖ series 32 ‖ next_seq u64 ‖ generation u32 ‖ capacity u32 ‖ order_count u32. */
export function fetchBookHeaders(client: OpsClient, books: readonly Address[]): Promise<Array<BookHeader | null>> {
  return sliced(client, books, 8 + 88, (address, data) => {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return { address, market: addressAt(data, 8), series: addressAt(data, 40), capacity: view.getUint32(8 + 76, true), orderCount: view.getUint32(8 + 80, true) };
  });
}

/** Ledger: discriminator 8 ‖ market 32 ‖ rent_payer 32 ‖ seat_bond u64 ‖ capacity u16 ‖ seats_used u16. */
export function fetchLedgerHeaders(client: OpsClient, ledgers: readonly Address[]): Promise<Array<LedgerHeader | null>> {
  return sliced(client, ledgers, 8 + 76, (address, data) => {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return { address, market: addressAt(data, 8), rentPayer: addressAt(data, 40), capacity: view.getUint16(8 + 72, true), seatsUsed: view.getUint16(8 + 74, true) };
  });
}

export const isFreeBook = (book: BookHeader) => book.market === DEFAULT_ADDRESS;

export type VenueConfig = { address: Address; collateralMint: Address; rollers: Address[]; mode: number; resultRetentionSec: number; clusterTag: number };

/** The GlobalConfig fields the venue actors read. */
export async function readVenueConfig(client: OpsClient): Promise<VenueConfig> {
  const [address] = await findConfigPda();
  const { data } = await client.agariEvents.accounts.globalConfig.fetch(address);
  return {
    address,
    collateralMint: data.collateralMint,
    rollers: data.rollers.filter((r) => r !== DEFAULT_ADDRESS),
    mode: data.mode,
    resultRetentionSec: data.resultRetentionSec,
    clusterTag: data.clusterTag,
  };
}
