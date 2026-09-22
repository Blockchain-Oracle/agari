/**
 * agari-desk bootstrap (desk.md §4.1–§4.2, plan §8 C6/C7), ensure-style like `deploy/vault.ts`: the singleton
 * `DeskConfig` once (admin = the program's upgrade authority, USDC, the router, the attestors, the cluster tag), and a
 * `DeskRef` for each of the eight PreStocks mints. Re-running creates only what is missing and fails loudly on drift.
 * `scripts/deploy/init-desk.ts` calls these against mainnet; `scripts/drive/desk-rehearsal.ts` against the fork.
 */
import { AGARI_DESK_PROGRAM_ADDRESS, getDeskConfigSize, getDeskRefSize } from "@agari/clients/agari-desk";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { getAddressDecoder, getBase64Encoder, type Address, type Base64EncodedDataResponse, type Rpc, type SolanaRpcApi } from "@solana/kit";
import { assertNoDrift, diffField, send, type SendContext } from "../deploy/send";
import { DESK_MINTS, deskConfigAddress, deskRefAddress } from "./deployment";
import { initConfigIx, initReferenceIx } from "./instructions";
import { readDeskConfig } from "./reads";

const BPF_LOADER_UPGRADEABLE = "BPFLoaderUpgradeab1e11111111111111111111111" as Address;
/** ProgramData: u32 enum tag (3) · u64 slot · u8 option · 32-byte authority. */
const AUTHORITY_OPTION_AT = 12;

export interface DeskInitWant {
  clusterTag: number;
  usdcMint: Address;
  swapProgram: Address;
  attestors: readonly Address[];
}

export interface DeskInitPlan {
  programId: Address;
  programDeployed: boolean;
  upgradeAuthority: Address | null;
  config: { address: Address; exists: boolean; rentLamports: bigint };
  references: { symbol: PreIpoSymbol; mint: Address; address: Address; exists: boolean }[];
  referenceRentLamports: bigint;
  /** Rent the run would pay for what is missing. */
  missingRentLamports: bigint;
}

/** The upgrade authority recorded in `program`'s ProgramData, or null when it is not an upgradeable program (or has none). */
export async function programUpgradeAuthority(rpc: Rpc<SolanaRpcApi>, program: Address): Promise<Address | null> {
  const { value } = await rpc.getAccountInfo(program, { encoding: "base64" }).send();
  if (!value || value.owner !== BPF_LOADER_UPGRADEABLE) return null;
  const bytes = new Uint8Array(getBase64Encoder().encode((value.data as Base64EncodedDataResponse)[0]));
  if (bytes.length < 36 || new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true) !== 2) return null;
  const programData = getAddressDecoder().decode(bytes.subarray(4, 36));
  const data = await rpc.getAccountInfo(programData, { encoding: "base64" }).send();
  if (!data.value) return null;
  const pd = new Uint8Array(getBase64Encoder().encode((data.value.data as Base64EncodedDataResponse)[0]));
  if (pd.length < AUTHORITY_OPTION_AT + 33 || pd[AUTHORITY_OPTION_AT] !== 1) return null;
  return getAddressDecoder().decode(pd.subarray(AUTHORITY_OPTION_AT + 1, AUTHORITY_OPTION_AT + 33));
}

/** What exists and what a run would create, with the rent it would pay; read-only. */
export async function readDeskInitPlan(rpc: Rpc<SolanaRpcApi>): Promise<DeskInitPlan> {
  const programId = AGARI_DESK_PROGRAM_ADDRESS;
  const [program, configAddress, configRent, refRent] = await Promise.all([
    rpc.getAccountInfo(programId, { encoding: "base64" }).send(),
    deskConfigAddress(),
    rpc.getMinimumBalanceForRentExemption(BigInt(getDeskConfigSize())).send(),
    rpc.getMinimumBalanceForRentExemption(BigInt(getDeskRefSize())).send(),
  ]);
  const refAddresses = await Promise.all(PRE_IPO_SYMBOLS.map((symbol) => deskRefAddress(DESK_MINTS[symbol])));
  const { value: accounts } = await rpc.getMultipleAccounts([configAddress, ...refAddresses], { encoding: "base64" }).send();
  const configExists = accounts[0] !== null;
  const references = PRE_IPO_SYMBOLS.map((symbol, i) => ({ symbol, mint: DESK_MINTS[symbol], address: refAddresses[i] as Address, exists: accounts[1 + i] !== null }));
  const missing = references.filter((r) => !r.exists).length;
  return {
    programId,
    programDeployed: Boolean(program.value?.executable),
    upgradeAuthority: program.value ? await programUpgradeAuthority(rpc, programId) : null,
    config: { address: configAddress, exists: configExists, rentLamports: configRent },
    references,
    referenceRentLamports: refRent,
    missingRentLamports: (configExists ? 0n : configRent) + BigInt(missing) * refRent,
  };
}

/**
 * `admin_init_config` signed by the client's payer, which must be the program's upgrade authority; skipped when the
 * config exists, and refused when the existing one differs from `want` (a drift is never auto-corrected).
 */
export async function ensureDeskConfig(ctx: SendContext, want: DeskInitWant): Promise<{ config: Address; signature: string | null }> {
  const config = await deskConfigAddress();
  const existing = await readDeskConfig(ctx.client.rpc);
  if (existing) {
    const diffs: string[] = [];
    diffField(diffs, "usdcMint", existing.usdcMint, want.usdcMint);
    diffField(diffs, "swapProgram", existing.swapProgram, want.swapProgram);
    diffField(diffs, "clusterTag", existing.clusterTag, want.clusterTag);
    diffField(diffs, "attestors", existing.attestors, want.attestors);
    assertNoDrift("DeskConfig", diffs);
    ctx.log({ step: "init config", signature: null, note: `exists ${config} (admin ${existing.admin})` });
    return { config, signature: null };
  }
  const ix = await initConfigIx({ admin: ctx.client.payer, usdcMint: want.usdcMint, swapProgram: want.swapProgram, clusterTag: want.clusterTag, attestors: want.attestors });
  const signature = await send(ctx, "init config", [ix], `DeskConfig ${config}, usdc ${want.usdcMint}, router ${want.swapProgram}, tag ${want.clusterTag}, attestors ${want.attestors.join(",")}`);
  return { config, signature };
}

/** `public_init_reference` for `mint`, paid by the client's payer; skipped when the `DeskRef` exists. */
export async function ensureDeskReference(ctx: SendContext, symbol: string, mint: Address): Promise<{ reference: Address; signature: string | null }> {
  const reference = await deskRefAddress(mint);
  const existing = await ctx.client.rpc.getAccountInfo(reference, { encoding: "base64" }).send();
  if (existing.value) {
    ctx.log({ step: `init ref ${symbol}`, signature: null, note: `exists ${reference}` });
    return { reference, signature: null };
  }
  const ix = await initReferenceIx(ctx.client.payer, mint);
  const signature = await send(ctx, `init ref ${symbol}`, [ix], `DeskRef ${reference} for ${mint}`);
  return { reference, signature };
}

export interface DeskInitRecord {
  programId: string;
  config: string;
  usdcMint: string;
  swapProgram: string;
  clusterTag: number;
  attestors: string[];
  references: Record<string, { mint: string; address: string; initSignature?: string }>;
  configInitSignature?: string;
}

/** Config then the eight references, in catalogue order; `record` is filled as each lands. */
export async function initDesk(ctx: SendContext, want: DeskInitWant, record: DeskInitRecord, save: () => void): Promise<DeskInitRecord> {
  const { config, signature } = await ensureDeskConfig(ctx, want);
  record.programId = AGARI_DESK_PROGRAM_ADDRESS;
  record.config = config;
  record.usdcMint = want.usdcMint;
  record.swapProgram = want.swapProgram;
  record.clusterTag = want.clusterTag;
  record.attestors = [...want.attestors];
  if (signature) record.configInitSignature = signature;
  save();
  for (const symbol of PRE_IPO_SYMBOLS) {
    const mint = DESK_MINTS[symbol];
    const ref = await ensureDeskReference(ctx, symbol, mint);
    const entry = (record.references[symbol] ??= { mint, address: ref.reference });
    entry.address = ref.reference;
    if (ref.signature) entry.initSignature = ref.signature;
    save();
  }
  return record;
}
