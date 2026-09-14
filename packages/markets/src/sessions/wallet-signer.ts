import {
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  getBase58Decoder,
  isTransactionModifyingSigner,
  isTransactionPartialSigner,
  isTransactionSendingSigner,
  signAndSendTransactionMessageWithSigners,
  signTransactionMessageWithSigners,
  type Base64EncodedWireTransaction,
  type Blockhash,
  type TransactionMessage,
  type TransactionMessageWithFeePayer,
  type TransactionMessageWithSigners,
  type TransactionSigner,
} from "@solana/kit";
import type { Signature } from "@agari/core/types";

/** What a session signs: a fee-payer message whose signers are attached to its accounts. */
export type SignableMessage = TransactionMessage & TransactionMessageWithFeePayer & TransactionMessageWithSigners;

/**
 * How a session's signer produces a write (first-call.md §3.4):
 * - `sign`: a Wallet Standard `solana:signTransaction` wallet (modify-and-sign) or a keypair. Markets holds the signed
 *   bytes and sends them itself, re-sending the same bytes while it confirms.
 * - `send`: a wallet that only offers `solana:signAndSendTransaction`. The wallet sends; markets only confirms.
 */
export type SigningMode = "sign" | "send";

export type SignedWrite =
  | {
      mode: "sign";
      signature: Signature;
      wire: Base64EncodedWireTransaction;
      /** The blockhash the signed bytes carry: a wallet may have replaced ours. */
      blockhash: Blockhash;
      /** Null when the wallet replaced the blockhash, so its last valid height is not known from the bytes. */
      lastValidBlockHeight: bigint | null;
    }
  | { mode: "send"; signature: Signature };

const U64_MAX = 0xffff_ffff_ffff_ffffn;

export function signingMode(signer: TransactionSigner): SigningMode {
  if (isTransactionModifyingSigner(signer) || isTransactionPartialSigner(signer)) return "sign";
  if (isTransactionSendingSigner(signer)) return "send";
  throw new Error(`signer ${(signer as { address: string }).address} can neither sign nor send transactions`);
}

/**
 * Signs (or, for a sending-only wallet, signs and sends) one message. The signature is read from what the wallet
 * returned, never from the message we built, because a modifying wallet may add instructions or a new blockhash.
 */
export async function signWrite(signer: TransactionSigner, message: SignableMessage, abortSignal?: AbortSignal): Promise<SignedWrite> {
  const config = abortSignal ? { abortSignal } : {};
  if (signingMode(signer) === "send") {
    const bytes = await signAndSendTransactionMessageWithSigners(message, config);
    return { mode: "send", signature: getBase58Decoder().decode(bytes) as Signature };
  }
  const transaction = await signTransactionMessageWithSigners(message, config);
  const lifetime = transaction.lifetimeConstraint;
  if (!("blockhash" in lifetime)) throw new Error("a session write must carry a blockhash lifetime");
  return {
    mode: "sign",
    signature: getSignatureFromTransaction(transaction) as string as Signature,
    wire: getBase64EncodedWireTransaction(transaction),
    blockhash: lifetime.blockhash,
    // Kit keeps our height when the wallet left the blockhash alone, and writes u64::MAX when it replaced it.
    lastValidBlockHeight: lifetime.lastValidBlockHeight === U64_MAX ? null : lifetime.lastValidBlockHeight,
  };
}
