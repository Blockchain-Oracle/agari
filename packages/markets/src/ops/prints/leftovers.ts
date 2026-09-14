/**
 * `PriceUpdateV2` accounts this relay posted and never closed (venue-ops.md §6.3). The receiver stores
 * `write_authority` right after the 8-byte discriminator, and only the write authority may `reclaim_rent`.
 */
import { getBase58Decoder, type Address, type Base58EncodedBytes } from "@solana/kit";
import { closePythUpdates, PYTH_RECEIVER_PROGRAM_ID } from "../../prices/legacy";
import type { OpsClient } from "../client";

/** `sha256("account:PriceUpdateV2")[..8]`. */
const PRICE_UPDATE_V2_DISCRIMINATOR = Uint8Array.from([34, 241, 35, 99, 157, 126, 244, 205]);

export async function findPriceUpdates(client: OpsClient, writeAuthority: string): Promise<string[]> {
  const rows = await client.rpc
    .getProgramAccounts(PYTH_RECEIVER_PROGRAM_ID as Address, {
      encoding: "base64",
      dataSlice: { offset: 0, length: 0 },
      filters: [
        { memcmp: { offset: 0n, bytes: getBase58Decoder().decode(PRICE_UPDATE_V2_DISCRIMINATOR) as Base58EncodedBytes, encoding: "base58" } },
        { memcmp: { offset: 8n, bytes: writeAuthority as Base58EncodedBytes, encoding: "base58" } },
      ],
    })
    .send();
  return rows.map((r) => String(r.pubkey));
}

/** Finds and closes every leftover; returns the addresses found and the close signatures. */
export async function closeLeftoverPriceUpdates(input: { client: OpsClient; rpcUrl: string; payerSecret: Uint8Array }): Promise<{ found: string[]; signatures: string[] }> {
  const found = await findPriceUpdates(input.client, input.client.payer.address);
  if (found.length === 0) return { found, signatures: [] };
  const signatures = await closePythUpdates({ rpcUrl: input.rpcUrl, payerSecret: input.payerSecret, addresses: found });
  return { found, signatures };
}
