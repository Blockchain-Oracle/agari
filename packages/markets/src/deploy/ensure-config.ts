/** Ensure-style: the tUSDC mint, the treasury token account and the GlobalConfig with its authorities. */
import {
  findConfigPda,
  getAdminInitConfigInstructionAsync,
  getAdminSetAuthoritiesInstructionAsync,
  type AdminSetAuthoritiesInstructionDataArgs,
  type GlobalConfig,
} from "@agari/clients/agari-events";
import { isSome, type Address, type KeyPairSigner } from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { assertNoDrift, diffField, hex, send, type StepContext } from "./send";
import { COLLATERAL_DECIMALS, RESULT_RETENTION_SEC } from "./venue-spec";

export async function ensureMint(ctx: StepContext, mint: KeyPairSigner, mintAuthority: Address): Promise<Address> {
  if (ctx.record.collateralMint && ctx.record.collateralMint !== mint.address) {
    assertNoDrift("tUSDC mint", [`recorded ${ctx.record.collateralMint} ≠ keypair ${mint.address}`]);
  }
  const existing = await ctx.client.token.accounts.mint.fetchMaybe(mint.address);
  if (existing.exists) {
    const diffs: string[] = [];
    diffField(diffs, "owner", existing.programAddress, TOKEN_PROGRAM_ADDRESS);
    diffField(diffs, "decimals", existing.data.decimals, COLLATERAL_DECIMALS);
    diffField(diffs, "mintAuthority", isSome(existing.data.mintAuthority) ? existing.data.mintAuthority.value : "none", mintAuthority);
    diffField(diffs, "freezeAuthority", isSome(existing.data.freezeAuthority) ? existing.data.freezeAuthority.value : "none", "none");
    assertNoDrift("tUSDC mint", diffs);
    ctx.log({ step: "mint", signature: null, note: `exists ${mint.address}` });
  } else {
    const plan = ctx.client.token.instructions.createMint({ newMint: mint, decimals: COLLATERAL_DECIMALS, mintAuthority, freezeAuthority: null });
    const result = await plan.sendTransaction();
    ctx.log({ step: "mint", signature: String(result.context.signature), note: `created ${mint.address} (6 dp, authority ${mintAuthority})` });
  }
  ctx.save({ ...ctx.record, collateralMint: mint.address, collateralDecimals: COLLATERAL_DECIMALS, mintAuthority });
  return mint.address;
}

/** The treasury is the admin's tUSDC associated token account; only donated residue reaches it (D-022). */
export async function ensureTreasury(ctx: StepContext, mint: Address): Promise<Address> {
  const owner = ctx.client.payer.address;
  const [treasury] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const existing = await ctx.client.token.accounts.token.fetchMaybe(treasury);
  if (existing.exists) {
    ctx.log({ step: "treasury", signature: null, note: `exists ${treasury}` });
  } else {
    const ix = await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: ctx.client.payer, owner, mint });
    await send(ctx, "treasury", [ix], `created ${treasury} (ATA of ${owner})`);
  }
  ctx.save({ ...ctx.record, treasury });
  return treasury;
}

export type ConfigWant = {
  clusterTag: number;
  programData: Address;
  mint: Address;
  treasury: Address;
  authorities: AdminSetAuthoritiesInstructionDataArgs;
};

function configDiffs(chain: GlobalConfig, admin: Address, want: ConfigWant): string[] {
  const a = want.authorities;
  const out: string[] = [];
  diffField(out, "admin", chain.admin, admin);
  diffField(out, "collateralMint", chain.collateralMint, want.mint);
  diffField(out, "tokenProgram", chain.tokenProgram, TOKEN_PROGRAM_ADDRESS);
  diffField(out, "treasury", chain.treasury, want.treasury);
  diffField(out, "clusterTag", chain.clusterTag, want.clusterTag);
  diffField(out, "collateralDecimals", chain.collateralDecimals, COLLATERAL_DECIMALS);
  diffField(out, "rollers", chain.rollers, a.rollers);
  diffField(out, "attestors", chain.attestors, a.attestors);
  diffField(out, "programAuthorities", chain.programAuthorities, a.programAuthorities);
  diffField(out, "redstoneSigners", chain.redstoneSigners.map(hex), a.redstoneSigners.map(hex));
  diffField(out, "redstoneSignerCount", chain.redstoneSignerCount, a.redstoneSignerCount);
  diffField(out, "redstoneThreshold", chain.redstoneThreshold, a.redstoneThreshold);
  diffField(out, "switchboardQueue", chain.switchboardQueue, a.switchboardQueue);
  diffField(out, "switchboardMinOracles", chain.switchboardMinOracles, a.switchboardMinOracles);
  diffField(out, "resultRetentionSec", chain.resultRetentionSec, a.resultRetentionSec);
  return out;
}

/** Init and authorities go in one transaction, so a config never exists without its signer sets. */
export async function ensureConfig(ctx: StepContext, want: ConfigWant): Promise<Address> {
  const admin = ctx.client.payer;
  const [config] = await findConfigPda();
  const existing = await ctx.client.agariEvents.accounts.globalConfig.fetchMaybe(config);
  if (existing.exists) {
    assertNoDrift("GlobalConfig", configDiffs(existing.data, admin.address, want));
    ctx.log({ step: "config", signature: null, note: `exists ${config}, matches` });
  } else {
    const init = await getAdminInitConfigInstructionAsync({
      admin,
      collateralMint: want.mint,
      treasury: want.treasury,
      programData: want.programData,
      clusterTag: want.clusterTag,
      resultRetentionSec: RESULT_RETENTION_SEC,
    });
    const authorities = await getAdminSetAuthoritiesInstructionAsync({ admin, treasury: want.treasury, ...want.authorities });
    await send(ctx, "config", [init, authorities], `created ${config} (cluster tag ${want.clusterTag}) with authorities`);
  }
  ctx.save({ ...ctx.record, admin: admin.address, config });
  return config;
}
