/** Surfpool `surfnet_profileTransaction`: compute units, size and logs of a transaction without landing it. */
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
} from "@solana/kit";
import type { SendContext } from "../send";

export type TransactionProfile = { computeUnits: number; bytes: number; error: string | null; logs: string[] };

/**
 * Builds a plain v0 message (fee payer, blockhash, the instructions, no compute-budget instruction, so the default
 * 200k limit applies), signs it and asks Surfpool to profile it. Nothing lands.
 */
export async function profileOnSurfpool(ctx: SendContext, rpcUrl: string, instructions: Instruction[]): Promise<TransactionProfile> {
  const { value: blockhash } = await ctx.client.rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(ctx.client.payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const wire = getBase64EncodedWireTransaction(await signTransactionMessageWithSigners(message));
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "surfnet_profileTransaction", params: [wire] }),
  });
  const body = (await res.json()) as {
    error?: { message: string };
    result?: { value?: ProfileBody } & ProfileBody;
  };
  if (body.error) throw new Error(`surfnet_profileTransaction: ${body.error.message}`);
  const profile = (body.result?.value ?? body.result)?.transactionProfile;
  if (!profile) throw new Error("surfnet_profileTransaction returned no transaction profile");
  return {
    computeUnits: profile.computeUnitsConsumed,
    bytes: atob(wire).length,
    error: profile.errorMessage ?? null,
    logs: profile.logMessages ?? [],
  };
}

type ProfileBody = { transactionProfile?: { computeUnitsConsumed: number; errorMessage?: string | null; logMessages?: string[] } };
