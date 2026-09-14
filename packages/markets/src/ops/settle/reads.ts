/** The small reads the settler needs beyond `fetchMarkets`: venue config, a Book's order count, a result's rent payer. */
import { findConfigPda, findResultPda, getGlobalConfigDecoder } from "@agari/clients/agari-events";
import { getAddressDecoder, getBase64Encoder, type Address } from "@solana/kit";
import type { OpsClient } from "../client";

export type VenueConfig = { address: Address; treasury: Address; collateralMint: Address; retentionSec: number };

const bytesOf = (b64: string) => getBase64Encoder().encode(b64);

export async function readVenueConfig(client: OpsClient): Promise<VenueConfig> {
  const [address] = await findConfigPda();
  const info = await client.rpc.getAccountInfo(address, { encoding: "base64" }).send();
  if (!info.value) throw new Error(`GlobalConfig ${address} not found`);
  const data = getGlobalConfigDecoder().decode(bytesOf(info.value.data[0]));
  return { address, treasury: data.treasury, collateralMint: data.collateralMint, retentionSec: data.resultRetentionSec };
}

/** `Book.order_count` (events-accounts.md §3.9: u32 at 8 + 80), read with a 4-byte data slice. Null if the Book is gone. */
export async function readBookOrderCount(client: OpsClient, book: Address): Promise<number | null> {
  const info = await client.rpc.getAccountInfo(book, { encoding: "base64", dataSlice: { offset: 88, length: 4 } }).send();
  if (!info.value) return null;
  const bytes = bytesOf(info.value.data[0]);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
}

/** `MarketResult.rent_payer` (8 + market 32 + series 32), or null when the result doesn't exist. */
export async function readResultRentPayer(client: OpsClient, market: Address): Promise<{ result: Address; rentPayer: Address } | null> {
  const [result] = await findResultPda({ market });
  const info = await client.rpc.getAccountInfo(result, { encoding: "base64", dataSlice: { offset: 72, length: 32 } }).send();
  if (!info.value) return null;
  return { result, rentPayer: getAddressDecoder().decode(bytesOf(info.value.data[0])) };
}
