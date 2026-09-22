/**
 * The desk runner's read side (S21 C4): a read RPC on the desk's explicit mainnet endpoint, every desk that names
 * one operator (discovery after a restart, a desk opened from the studio the database never saw), and the fate of a
 * signature the runner sent but never saw confirmed. `services/ops` imports these; it never imports `@solana/*`.
 */
import { AGARI_DESK_PROGRAM_ADDRESS, DESK_DISCRIMINATOR, getDeskDecoder, getDeskSize } from "@agari/clients/agari-desk";
import { deskModeOf, type DeskMode } from "@agari/core/desk";
import type { Hash32 } from "@agari/core/types";
import { createSolanaRpcFromTransport, getBase58Decoder, type Address, type Base58EncodedBytes, type Signature } from "@solana/kit";
import { retryingRpcTransport } from "../deploy/rpc-transport";
import type { DeskRpc } from "./reads";

const NO_KEY = "11111111111111111111111111111111";
/** Anchor's 8-byte discriminator precedes the struct: `owner` @8, `operator` @40 (desk.md §2). */
const OPERATOR_OFFSET = 40n;
const READ_TIMEOUT_MS = 20_000;
const bounded = () => ({ abortSignal: AbortSignal.timeout(READ_TIMEOUT_MS) });

/** A paced, retrying read RPC for `rpcUrl` (the operator client composes its own over the same transport). */
export function createDeskRpc(rpcUrl: string): DeskRpc {
  return createSolanaRpcFromTransport(retryingRpcTransport(rpcUrl, "normal"));
}

export interface DiscoveredDesk {
  address: Address;
  owner: Address;
  operator: Address | null;
  mode: DeskMode;
  paused: boolean;
  seq: bigint;
  head: Hash32;
}

const hex = (bytes: ArrayLike<number>): Hash32 => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

/** Every `Desk` account whose operator is `operator`, from the program's accounts (three filters: size, discriminator, operator). */
export async function listDesksByOperator(rpc: DeskRpc, operator: Address): Promise<DiscoveredDesk[]> {
  const base58 = getBase58Decoder();
  const rows = await rpc
    .getProgramAccounts(AGARI_DESK_PROGRAM_ADDRESS, {
      encoding: "base64",
      commitment: "confirmed",
      filters: [
        { dataSize: BigInt(getDeskSize()) },
        { memcmp: { offset: 0n, bytes: base58.decode(DESK_DISCRIMINATOR) as Base58EncodedBytes, encoding: "base58" } },
        { memcmp: { offset: OPERATOR_OFFSET, bytes: operator as string as Base58EncodedBytes, encoding: "base58" } },
      ],
    })
    .send(bounded());
  const decoder = getDeskDecoder();
  return rows.map((row) => {
    const d = decoder.decode(Uint8Array.from(Buffer.from(row.account.data[0], "base64")));
    return { address: row.pubkey, owner: d.owner, operator: (d.operator as string) === NO_KEY ? null : d.operator, mode: deskModeOf(d.mode) ?? "practice", paused: d.paused !== 0, seq: d.seq, head: hex(d.head) };
  });
}

export type SignatureOutcome = { kind: "confirmed"; slot: bigint } | { kind: "failed"; slot: bigint } | { kind: "pending" } | { kind: "none" };

/**
 * What the chain says about one signature, transaction history included. `none` means no node has seen it: past
 * the action's own deadline that is proof it never landed; before it, the runner keeps holding.
 */
export async function signatureOutcome(rpc: DeskRpc, signature: string): Promise<SignatureOutcome> {
  const { value } = await rpc.getSignatureStatuses([signature as Signature], { searchTransactionHistory: true }).send(bounded());
  const status = value[0] ?? null;
  if (!status) return { kind: "none" };
  const settled = status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized";
  if (!settled) return { kind: "pending" };
  return status.err ? { kind: "failed", slot: status.slot } : { kind: "confirmed", slot: status.slot };
}

/** The chain's clock, for deadlines the program measures against `Clock::unix_timestamp`. */
export async function chainNowSec(rpc: DeskRpc): Promise<number> {
  const slot = await rpc.getSlot({ commitment: "confirmed" }).send(bounded());
  const time = await rpc.getBlockTime(slot).send(bounded());
  return Number(time);
}
