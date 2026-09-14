/** Role funding for `scripts/deploy/fund-roles.ts`: SOL top-ups from the client's payer and tUSDC from the faucet authority. */
import { getTransferSolInstruction } from "@solana-program/system";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address, KeyPairSigner } from "@solana/kit";
import { COLLATERAL_DECIMALS } from "../../deploy/venue-spec";
import type { OpsClient } from "../client";
import { sendOps } from "../send";

export async function lamportsOf(client: OpsClient, owner: Address): Promise<bigint> {
  return (await client.rpc.getBalance(owner).send()).value;
}

export async function transferSol(client: OpsClient, destination: Address, lamports: bigint): Promise<string> {
  const ix = getTransferSolInstruction({ source: client.payer, destination, amount: lamports });
  return (await sendOps(client, [ix], `transfer ${lamports} lamports`)).signature;
}

/** The owner's collateral ATA and its balance in base units (0 when the ATA doesn't exist). */
export async function collateralBalanceOf(client: OpsClient, owner: Address, mint: Address): Promise<{ ata: Address; amount: bigint }> {
  const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const info = await client.rpc.getAccountInfo(ata, { encoding: "base64" }).send();
  if (!info.value) return { ata, amount: 0n };
  const { value } = await client.rpc.getTokenAccountBalance(ata).send();
  return { ata, amount: BigInt(value.amount) };
}

/** Mints `amount` base units to the owner's ATA (created if missing, rent from the client's payer). */
export async function mintCollateral(client: OpsClient, input: { faucet: KeyPairSigner; mint: Address; owner: Address; amount: bigint }): Promise<string> {
  const [ata] = await findAssociatedTokenPda({ owner: input.owner, mint: input.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const result = await client.token.instructions
    .mintToATA({ ata, owner: input.owner, mint: input.mint, mintAuthority: input.faucet, amount: input.amount, decimals: COLLATERAL_DECIMALS })
    .sendTransaction();
  return String(result.context.signature);
}
