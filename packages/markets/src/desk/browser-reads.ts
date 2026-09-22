/**
 * Reads the desk's web surfaces make THROUGH the app's own mainnet endpoint (`/api/rpc/mainnet`, D-121), never the
 * devnet read runtime: a Kit RPC over a URL, the owner's own balances of the names and USDC (the money sheet's
 * receipts), and one transaction's sealed events ("Check it" asks the chain from the reader's browser, so the
 * comparison never rests on a number the server supplied). Server routes use the same helpers over the Helius URL.
 */
import type { PreIpoSymbol } from "@agari/core/market";
import { createDefaultRpcTransport, createSolanaRpcFromTransport, getBase64Encoder, type Address, type Base64EncodedDataResponse, type Signature } from "@solana/kit";
import { associatedTokenAddress, DESK_MINTS, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, USDC_MAINNET } from "./deployment";
import { readDeskEventsOf, sealedActionsOf, type SealedAction } from "./history";
import { readDeskMints, type DeskRpc } from "./reads";

/** Token account layout: `amount` u64 at 64. */
const AMOUNT_AT = 64;

/** The browser's RPC over the app's own mainnet proxy path; the runner's `createDeskRpc` (rpc.ts) wraps a retrying transport instead. */
export function createBrowserDeskRpc(url: string): DeskRpc {
  return createSolanaRpcFromTransport(createDefaultRpcTransport({ url: url as Parameters<typeof createDefaultRpcTransport>[0]["url"] })) as DeskRpc;
}

export interface OwnerNameBalance {
  symbol: PreIpoSymbol;
  mint: Address;
  ownerToken: Address;
  raw: bigint;
  /** The mint's effective ScaledUiAmount multiplier now; null when it could not be read exactly. */
  multiplierE12: bigint | null;
  paused: boolean | null;
}

export interface OwnerDeskBalances {
  lamports: bigint;
  usdc: { ownerToken: Address; raw: bigint };
  names: OwnerNameBalance[];
  slot: bigint;
}

function amountOf(data: Base64EncodedDataResponse | undefined): bigint {
  if (!data) return 0n;
  const bytes = getBase64Encoder().encode(data[0]) as Uint8Array;
  if (bytes.length < AMOUNT_AT + 8) return 0n;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(AMOUNT_AT, true);
}

/** What the owner's own wallet holds that a desk can take: SOL for fees, USDC, and each of `symbols` (raw, 9 dp). */
export async function readOwnerDeskBalances(rpc: DeskRpc, owner: Address, symbols: readonly PreIpoSymbol[], nowSec: number): Promise<OwnerDeskBalances> {
  const usdcAta = await associatedTokenAddress(owner, USDC_MAINNET, TOKEN_PROGRAM);
  const mints = symbols.map((symbol) => DESK_MINTS[symbol]);
  const atas = await Promise.all(mints.map((mint) => associatedTokenAddress(owner, mint, TOKEN_2022_PROGRAM)));
  const [ownerInfo, accounts, mintStates] = await Promise.all([
    rpc.getAccountInfo(owner, { commitment: "confirmed", encoding: "base64" }).send(),
    rpc.getMultipleAccounts([usdcAta, ...atas], { encoding: "base64", commitment: "confirmed" }).send(),
    readDeskMints(rpc, mints, nowSec),
  ]);
  return {
    lamports: ownerInfo.value?.lamports ?? 0n,
    usdc: { ownerToken: usdcAta, raw: amountOf(accounts.value[0]?.data as Base64EncodedDataResponse | undefined) },
    names: symbols.map((symbol, i) => {
      const mint = mints[i] as Address;
      const state = mintStates[mint as string];
      return { symbol, mint, ownerToken: atas[i] as Address, raw: amountOf(accounts.value[1 + i]?.data as Base64EncodedDataResponse | undefined), multiplierE12: state?.multiplierE12 ?? null, paused: state?.paused ?? null };
    }),
    slot: accounts.context.slot,
  };
}

/** The `Bought`/`Sold`/`Checkpoint` seals one confirmed transaction carries; empty for a failed or unknown one. */
export async function readSealsOf(rpc: DeskRpc, signature: Signature): Promise<SealedAction[]> {
  return sealedActionsOf(await readDeskEventsOf(rpc, signature));
}
