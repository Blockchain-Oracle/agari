/**
 * The season prize pool's chain work (S12b). Scripts may not import the chain SDKs (plan §6), so it lives here and
 * `scripts/drive/duel-arena.ts` passes plain values. The distribution itself is `distributeSeasonPrizes` in
 * `@agari/markets/games`, the same call the admin's own surface makes.
 */
import { getAdminCreateSeasonInstructionAsync, getAdminWithdrawSeasonRemainderInstructionAsync, getPublicDepositSeasonInstructionAsync } from "@agari/clients/agari-arena";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstructionAsync, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { AccountRole, getBase64Encoder, type Address, type Instruction } from "@solana/kit";
import { send, type SendContext } from "./send";

async function tokenBalance(ctx: SendContext, account: Address): Promise<bigint> {
  const info = await ctx.client.rpc.getAccountInfo(account, { encoding: "base64" }).send();
  if (!info.value) return 0n;
  const bytes = getBase64Encoder().encode(info.value.data[0]);
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(64, true);
}

export async function createSeasonPool(ctx: SendContext, seasonId: string, endsAtSec: number, collateralMint: Address) {
  const ix = await getAdminCreateSeasonInstructionAsync({ admin: ctx.client.payer, collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS, seasonId, endsAtSec });
  return send(ctx, "create season", [ix], `${seasonId}, ends ${new Date(endsAtSec * 1000).toISOString()}`);
}

/** Anyone may fund a season: money going in is always safe. */
export async function depositSeasonPool(ctx: SendContext, seasonId: string, amountBase: bigint, season: Address, vault: Address, collateralMint: Address) {
  const [fromToken] = await findAssociatedTokenPda({ owner: ctx.client.payer.address, mint: collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const ix = await getPublicDepositSeasonInstructionAsync({ from: ctx.client.payer, season, vault, fromToken, collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS, amountBase });
  const signature = await send(ctx, "deposit season", [ix], `${amountBase} into ${seasonId}`);
  return { signature, balanceBase: await tokenBalance(ctx, vault) };
}

/**
 * The safety hatch: what is left, to the admin's own account, before or after a distribution.
 *
 * An SPL transfer needs a destination that exists, and an admin who has never held the collateral has none, so the
 * account is created in the same transaction. Without that the hatch fails with the token program's
 * `InvalidAccountData`, which reads like a bug in the pool rather than a missing account (the devnet run of 18:12Z).
 */
export async function withdrawSeasonRemainder(ctx: SendContext, season: Address, vault: Address, collateralMint: Address) {
  const [to] = await findAssociatedTokenPda({ owner: ctx.client.payer.address, mint: collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const create = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.client.payer, owner: ctx.client.payer.address, mint: collateralMint });
  const withdraw = await getAdminWithdrawSeasonRemainderInstructionAsync({ admin: ctx.client.payer, season, vault, collateralMint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const ix: Instruction = { ...withdraw, accounts: [...(withdraw.accounts ?? []), { address: to, role: AccountRole.WRITABLE }] };
  const signature = await send(ctx, "withdraw season", [create, ix], `what is left of the pool, to ${to}`);
  return { signature, balanceBase: await tokenBalance(ctx, vault) };
}
