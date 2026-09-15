/**
 * The replay's Kit reads: the posted accounts, the payer's balance and its leftover price updates. Sends go through
 * `prices/legacy` (web3.js 1, the receiver SDK); nothing here signs.
 */
import { address, createSolanaRpc, getBase58Decoder, type Base58EncodedBytes } from "@solana/kit";
import { PYTH_RECEIVER_PROGRAM_ID } from "../prices/legacy";
import { decodePriceUpdateV2, PRICE_UPDATE_V2_DISCRIMINATOR, type PriceUpdateV2 } from "./decode";

const rpcs = new Map<string, ReturnType<typeof createSolanaRpc>>();
function rpcFor(rpcUrl: string) {
  let rpc = rpcs.get(rpcUrl);
  if (!rpc) rpcs.set(rpcUrl, (rpc = createSolanaRpc(rpcUrl)));
  return rpc;
}

/** A hung public endpoint must fail the replay, not hold its claim. */
const bounded = () => ({ abortSignal: AbortSignal.timeout(20_000) });

export interface PostedAccount {
  owner: string;
  update: PriceUpdateV2;
}

/** Null when the account does not exist (closed, or never landed). */
export async function readPostedAccount(rpcUrl: string, account: string): Promise<PostedAccount | null> {
  const { value } = await rpcFor(rpcUrl).getAccountInfo(address(account), { encoding: "base64", commitment: "confirmed" }).send(bounded());
  if (!value) return null;
  const data = Uint8Array.from(Buffer.from(value.data[0], "base64"));
  return { owner: String(value.owner), update: decodePriceUpdateV2(data) };
}

export async function balanceLamports(rpcUrl: string, owner: string): Promise<bigint> {
  const { value } = await rpcFor(rpcUrl).getBalance(address(owner), { commitment: "confirmed" }).send(bounded());
  return value;
}

/** The chain head and each account's `posted_slot` (null for an account that is gone or not a price update). */
export async function postedSlots(rpcUrl: string, accounts: readonly string[]): Promise<{ headSlot: bigint; posted: Map<string, bigint | null> }> {
  const rpc = rpcFor(rpcUrl);
  const headSlot = await rpc.getSlot({ commitment: "confirmed" }).send(bounded());
  const posted = new Map<string, bigint | null>();
  for (let i = 0; i < accounts.length; i += 100) {
    const chunk = accounts.slice(i, i + 100);
    const { value } = await rpc.getMultipleAccounts(chunk.map((a) => address(a)), { encoding: "base64", commitment: "confirmed" }).send(bounded());
    value.forEach((info, j) => {
      let slot: bigint | null = null;
      try {
        if (info) slot = decodePriceUpdateV2(Uint8Array.from(Buffer.from(info.data[0], "base64"))).postedSlot;
      } catch {
        slot = null;
      }
      posted.set(chunk[j]!, slot);
    });
  }
  return { headSlot, posted };
}

/** Every `PriceUpdateV2` the payer may close (its write authority), whether or not a stored proof names it. */
export async function payerPriceUpdates(rpcUrl: string, payer: string): Promise<string[]> {
  const rows = await rpcFor(rpcUrl)
    .getProgramAccounts(address(PYTH_RECEIVER_PROGRAM_ID), {
      encoding: "base64",
      dataSlice: { offset: 0, length: 0 },
      filters: [
        { memcmp: { offset: 0n, bytes: getBase58Decoder().decode(PRICE_UPDATE_V2_DISCRIMINATOR) as Base58EncodedBytes, encoding: "base58" } },
        { memcmp: { offset: 8n, bytes: payer as Base58EncodedBytes, encoding: "base58" } },
      ],
    })
    .send(bounded());
  return rows.map((r) => String(r.pubkey));
}
