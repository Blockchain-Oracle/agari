import type { TransactionSigner } from "@solana/kit";
import { signWrite, type SignedWrite } from "../../sessions/wallet-signer";
import type { BuiltWrite, WriteRpc } from "./message";

/**
 * Blocks a blockhash stays valid for. When a wallet replaced our blockhash (or sent the transaction itself), the
 * height of its blockhash is unknown; the head's own last valid height plus this margin is a safe upper bound.
 */
const REPLACED_BLOCKHASH_MARGIN = 150n;

export type SignedStep = SignedWrite & {
  /** Past this block height a signature with no status never landed (D-033). */
  lastValidBlockHeight: bigint;
};

async function upperBoundHeight(rpc: WriteRpc, built: BuiltWrite): Promise<bigint> {
  const { value } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const bound = value.lastValidBlockHeight + REPLACED_BLOCKHASH_MARGIN;
  return bound > built.lastValidBlockHeight ? bound : built.lastValidBlockHeight;
}

/**
 * The wallet popup (or the keypair). A modify-and-sign wallet hands back bytes markets sends; a sending-only wallet
 * returns once it has sent. A rejection throws: the lane diagnoses it (`user-rejected`, wallet code 4001).
 */
export async function signStep(rpc: WriteRpc, signer: TransactionSigner, built: BuiltWrite, abortSignal?: AbortSignal): Promise<SignedStep> {
  const signed = await signWrite(signer, built.message, abortSignal);
  if (signed.mode === "sign" && signed.lastValidBlockHeight !== null) return { ...signed, lastValidBlockHeight: signed.lastValidBlockHeight };
  return { ...signed, lastValidBlockHeight: await upperBoundHeight(rpc, built) };
}
