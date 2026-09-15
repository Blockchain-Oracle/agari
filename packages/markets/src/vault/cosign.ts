/**
 * The sponsor fee-payer seam on the client (tap-trading.md §3, D-065). Markets builds the v0 message with the sponsor
 * as fee payer, signs it partially (the key or the owner), and asks the co-signer; the co-signer (web's `/api/sponsor`
 * transport, or a drive's local key) signs slot 0 only and never sends. Markets checks the bytes it got back, journals
 * the signature, then sends and confirms on the S4 lane. A refusal falls back to the signer paying its own fee.
 */
import { diagnosis, type Address, type Signature } from "@agari/core/types";
import {
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getSignatureFromTransaction,
  getTransactionDecoder,
  partiallySignTransactionMessageWithSigners,
  type Base64EncodedWireTransaction,
  type Instruction,
  type Address as KitAddress,
  type Transaction,
  type TransactionPartialSigner,
} from "@solana/kit";
import { diagnose } from "../errors/error-map";
import { OrderRefusedError, SimulationFailedError } from "../submitter/errors";
import { checkGas } from "../submitter/fees";
import { journalSendConfirm, signSendConfirm, type Settled, type WriteContext } from "../submitter/settle-write";
import { buildWrite, type BuiltWrite } from "../submitter/steps/message";
import { signingMode } from "../sessions/wallet-signer";

export type CosignResult = { ok: true; transaction: string; signature: Signature } | { ok: false; reason: string };

export interface SponsorCosigner {
  /** The fee payer to build with; null = no sponsor configured, the signer pays its own fee. */
  sponsor(): Promise<Address | null>;
  /** The partially signed wire transaction co-signed as fee payer (never sent), or the sponsor's refusal. */
  cosign(request: { transaction: Base64EncodedWireTransaction; lastValidBlockHeight: bigint }): Promise<CosignResult>;
}

/** A write built for a fee payer: the sponsor when one is configured and simulation accepted it, else the signer. */
export interface PaidWrite {
  built: BuiltWrite;
  sponsor: SponsorCosigner | null;
  instructions: readonly Instruction[];
}

const FEE_PAYER_REFUSALS = new Set(["InsufficientFundsForFee", "InsufficientFundsForRent", "AccountNotFound", "InvalidAccountForFee"]);

/**
 * Builds with the sponsor as fee payer when the write is sponsorable and a sponsor is configured. A simulation that
 * fails on the fee payer itself (an unfunded sponsor) means no sponsor this time; any other failure is the write's own
 * and throws as usual. A sending-only wallet can't sign partially, so it always pays.
 */
export async function buildPaid(ctx: WriteContext, instructions: readonly Instruction[], sponsorable: boolean): Promise<PaidWrite> {
  const sponsor = sponsorable && ctx.sponsor && signingMode(ctx.signer) === "sign" ? ctx.sponsor : null;
  const feePayer = sponsor ? await sponsor.sponsor().catch(() => null) : null;
  if (sponsor && feePayer) {
    try {
      return { built: await buildWrite(ctx.rpc, feePayer as string as KitAddress, instructions), sponsor, instructions };
    } catch (error) {
      const err = error instanceof SimulationFailedError ? error.failure.err : null;
      if (!(typeof err === "string" && FEE_PAYER_REFUSALS.has(err))) throw error;
    }
  }
  return { built: await buildWrite(ctx.rpc, ctx.signer, instructions), sponsor: null, instructions };
}

function sameBytes(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** The co-signed bytes must carry our message and our signature untouched, plus a fee payer signature (its txid). */
function checkCosigned(ours: Transaction, wire: string, signer: KitAddress): { wire: Base64EncodedWireTransaction; signature: Signature } {
  const theirs = getTransactionDecoder().decode(getBase64Encoder().encode(wire));
  if (!sameBytes(theirs.messageBytes, ours.messageBytes)) throw new Error("the sponsor returned a different message than the one signed");
  const mine = ours.signatures[signer];
  const kept = theirs.signatures[signer];
  if (!mine || !kept || !sameBytes(kept, mine)) throw new Error("the sponsor's transaction does not carry the signer's signature");
  const signature = getSignatureFromTransaction(theirs) as string as Signature;
  return { wire: getBase64EncodedWireTransaction(theirs), signature };
}

type Cosigned = Settled | { kind: "cosign-refused"; reason: string };

async function cosignSendConfirm(ctx: WriteContext, recordId: string, paid: PaidWrite & { sponsor: SponsorCosigner }, onPhase?: Parameters<typeof signSendConfirm>[3]): Promise<Cosigned> {
  const { built } = paid;
  let partial: Transaction;
  try {
    partial = await partiallySignTransactionMessageWithSigners(built.message);
  } catch (error) {
    await ctx.journal.markFailed(recordId, diagnose(error).technical);
    return { kind: "not-sent", error };
  }
  const request = { transaction: getBase64EncodedWireTransaction(partial), lastValidBlockHeight: built.lastValidBlockHeight };
  const answer = await paid.sponsor.cosign(request).catch((error: unknown): CosignResult => ({ ok: false, reason: diagnose(error).technical }));
  if (!answer.ok) return { kind: "cosign-refused", reason: answer.reason };
  let checked: ReturnType<typeof checkCosigned>;
  try {
    checked = checkCosigned(partial, answer.transaction, (ctx.signer as TransactionPartialSigner).address);
  } catch (error) {
    return { kind: "cosign-refused", reason: diagnose(error).technical };
  }
  // A tab killed before this line never sent (the server never sends); after it, recovery asks by signature.
  return journalSendConfirm(ctx, recordId, { ...checked, lastValidBlockHeight: built.lastValidBlockHeight }, onPhase);
}

/**
 * Sign (or co-sign) → journal → send → confirm for a write `buildPaid` prepared. When the sponsor refuses, the signer
 * pays if it holds the fee reserve (the write is rebuilt with it as fee payer); otherwise nothing is sent and the
 * refusal names both reasons (tap-trading.md §1.3 step 8).
 */
export async function sendPaid(ctx: WriteContext, recordId: string, paid: PaidWrite, onPhase?: Parameters<typeof signSendConfirm>[3]): Promise<Settled> {
  if (!paid.sponsor) return signSendConfirm(ctx, recordId, paid.built, onPhase);
  const cosigned = await cosignSendConfirm(ctx, recordId, { ...paid, sponsor: paid.sponsor }, onPhase);
  if (cosigned.kind !== "cosign-refused") return cosigned;
  const gas = await checkGas(ctx.rpc, ctx.wallet, "vault-order");
  if (!gas.ok) {
    const refusal = new OrderRefusedError(diagnosis("out-of-gas", `the sponsor refused (${cosigned.reason}) and ${gas.diagnosis.technical}`));
    await ctx.journal.markFailed(recordId, refusal.diagnosis.technical);
    return { kind: "not-sent", error: refusal };
  }
  let built: BuiltWrite;
  try {
    built = await buildWrite(ctx.rpc, ctx.signer, paid.instructions);
  } catch (error) {
    await ctx.journal.markFailed(recordId, diagnose(error).technical);
    return { kind: "not-sent", error };
  }
  return signSendConfirm(ctx, recordId, built, onPhase);
}

/**
 * A co-signer over a local keypair signer with no policy: for drives and ops scripts that pay their own session's
 * fees from a role key. The web uses `/api/sponsor`, whose policy this does not apply.
 */
export function localCosigner(feePayer: TransactionPartialSigner): SponsorCosigner {
  return {
    sponsor: async () => feePayer.address as string as Address,
    async cosign({ transaction }) {
      const tx = getTransactionDecoder().decode(getBase64Encoder().encode(transaction));
      const [signatures] = await feePayer.signTransactions([tx as Parameters<TransactionPartialSigner["signTransactions"]>[0][number]]);
      const signed = { ...tx, signatures: { ...tx.signatures, ...signatures } } as Transaction;
      return { ok: true, transaction: getBase64EncodedWireTransaction(signed), signature: getSignatureFromTransaction(signed) as string as Signature };
    },
  };
}
