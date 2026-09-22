/**
 * Address lookup tables for a Jupiter route (plan §8 C3): the desk's transaction carries the route's accounts, so a
 * v0 message compressed with Jupiter's tables is what keeps it under the size limit. Tables are read raw: the
 * account's 56-byte header (deactivation slot, last extended slot and index, an optional authority, padding) is
 * followed by 32-byte addresses.
 */
import {
  compressTransactionMessageUsingAddressLookupTables,
  getAddressDecoder,
  getBase64Encoder,
  type Address,
  type AddressesByLookupTableAddress,
  type Base64EncodedDataResponse,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";

const HEADER_BYTES = 56;
const ADDRESS_BYTES = 32;

/** The addresses each table holds, keyed by table. A table that does not exist is left out. */
export async function fetchLookupTables(rpc: Rpc<SolanaRpcApi>, tables: readonly Address[]): Promise<AddressesByLookupTableAddress> {
  if (tables.length === 0) return {};
  const { value } = await rpc.getMultipleAccounts(tables, { encoding: "base64", commitment: "confirmed" }).send();
  const decoder = getAddressDecoder();
  const out: AddressesByLookupTableAddress = {};
  value.forEach((account, i) => {
    if (!account) return;
    const bytes = new Uint8Array(getBase64Encoder().encode((account.data as Base64EncodedDataResponse)[0]));
    const addresses: Address[] = [];
    for (let at = HEADER_BYTES; at + ADDRESS_BYTES <= bytes.length; at += ADDRESS_BYTES) addresses.push(decoder.decode(bytes.subarray(at, at + ADDRESS_BYTES)));
    out[tables[i] as Address] = addresses;
  });
  return out;
}

/** The message compressed with `tables` when there are any; unchanged otherwise. */
type Compressible = Parameters<typeof compressTransactionMessageUsingAddressLookupTables>[0];

export function withLookupTables<T extends Compressible>(message: T, tables: AddressesByLookupTableAddress): T {
  return Object.keys(tables).length === 0 ? message : (compressTransactionMessageUsingAddressLookupTables(message, tables) as unknown as T);
}
