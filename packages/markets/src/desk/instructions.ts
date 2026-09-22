/**
 * agari-desk instruction builders (desk.md §4): thin wrappers over the generated client that fill the program's own
 * `#[event_cpi]` pair, derive the desk's associated accounts, and append a router's route as remaining accounts.
 * Builders only: the operator client and the browser session plan, simulate and sign.
 */
import {
  AGARI_DESK_PROGRAM_ADDRESS,
  getAdminInitConfigInstructionAsync,
  getAdminSetAttestorsInstruction,
  getAdminSetReferenceFeedInstructionAsync,
  getOperatorBuyInstructionAsync,
  getOperatorCheckpointInstructionAsync,
  getOperatorSellInstructionAsync,
  getOwnerAllowTokenInstructionAsync,
  getOwnerDepositInstructionAsync,
  getOwnerDisallowTokenInstructionAsync,
  getOwnerOpenDeskInstructionAsync,
  getOwnerRevokeOperatorInstructionAsync,
  getOwnerSetLimitsInstructionAsync,
  getOwnerSetModeInstructionAsync,
  getOwnerSetOperatorInstructionAsync,
  getOwnerUnpauseInstructionAsync,
  getOwnerWithdrawInstructionAsync,
  getPauseInstructionAsync,
  getPublicInitReferenceInstructionAsync,
  getPublicPostReferenceInstructionAsync,
} from "@agari/clients/agari-desk";
import { DESK_MODE_CODE, hash32Bytes, type DeskMode } from "@agari/core/desk";
import type { Hash32 } from "@agari/core/types";
import { address, getAddressEncoder, getProgramDerivedAddress, type AccountMeta, type Address, type Instruction, type TransactionSigner } from "@solana/kit";
import { associatedTokenAddress, deskAddress, deskEventAuthority, JUPITER_V6, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, tokenProgramOf, USDC_MAINNET } from "./deployment";

const emit = async () => ({ eventAuthority: await deskEventAuthority(), program: AGARI_DESK_PROGRAM_ADDRESS });
const hashArg = (hash: Hash32) => hash32Bytes(hash);

export interface OpenDeskInput {
  owner: TransactionSigner;
  operator: Address;
  perActionCapE6: bigint;
  dailyCapE6: bigint;
  maxPremiumBps: number;
  mode: DeskMode;
  usdcMint?: Address;
}

export async function openDeskIx(i: OpenDeskInput): Promise<Instruction> {
  const usdcMint = i.usdcMint ?? USDC_MAINNET;
  const desk = await deskAddress(i.owner.address);
  const deskUsdc = await associatedTokenAddress(desk, usdcMint, TOKEN_PROGRAM);
  return getOwnerOpenDeskInstructionAsync({ owner: i.owner, usdcMint, deskUsdc, operator: i.operator, perActionCap: i.perActionCapE6, dailyCap: i.dailyCapE6, maxPremiumBps: i.maxPremiumBps, mode: DESK_MODE_CODE[i.mode], ...(await emit()) });
}

export async function allowTokenIx(owner: TransactionSigner, mint: Address): Promise<Instruction> {
  const desk = await deskAddress(owner.address);
  const deskAta = await associatedTokenAddress(desk, mint, TOKEN_2022_PROGRAM);
  return getOwnerAllowTokenInstructionAsync({ owner, mint, deskAta, tokenProgram: TOKEN_2022_PROGRAM, ...(await emit()) });
}

export async function disallowTokenIx(owner: TransactionSigner, mint: Address): Promise<Instruction> {
  return getOwnerDisallowTokenInstructionAsync({ owner, mint, ...(await emit()) });
}

/** `ownerToken` is any token account of `mint` the owner signs for (its associated one, normally). */
export async function depositIx(owner: TransactionSigner, mint: Address, ownerToken: Address, amount: bigint, usdcMint: Address = USDC_MAINNET): Promise<Instruction> {
  return getOwnerDepositInstructionAsync({ owner, mint, ownerToken, amount, tokenProgram: tokenProgramOf(mint, usdcMint), ...(await emit()) });
}

/** `amount` `u64::MAX` withdraws the whole balance. The program requires `ownerAta` to be the owner's associated account. */
export async function withdrawIx(owner: TransactionSigner, mint: Address, amount: bigint, usdcMint: Address = USDC_MAINNET): Promise<Instruction> {
  const tokenProgram = tokenProgramOf(mint, usdcMint);
  const ownerAta = await associatedTokenAddress(owner.address, mint, tokenProgram);
  return getOwnerWithdrawInstructionAsync({ owner, mint, ownerAta, amount, tokenProgram, ...(await emit()) });
}

export const WHOLE_BALANCE = 0xffff_ffff_ffff_ffffn;

export async function setLimitsIx(owner: TransactionSigner, perActionCapE6: bigint, dailyCapE6: bigint, maxPremiumBps: number, requirePythIndex: boolean): Promise<Instruction> {
  return getOwnerSetLimitsInstructionAsync({ owner, perActionCap: perActionCapE6, dailyCap: dailyCapE6, maxPremiumBps, requirePythIndex, ...(await emit()) });
}

export async function setModeIx(owner: TransactionSigner, mode: DeskMode): Promise<Instruction> {
  return getOwnerSetModeInstructionAsync({ owner, mode: DESK_MODE_CODE[mode], ...(await emit()) });
}

export async function setOperatorIx(owner: TransactionSigner, operator: Address): Promise<Instruction> {
  return getOwnerSetOperatorInstructionAsync({ owner, operator, ...(await emit()) });
}

export async function revokeOperatorIx(owner: TransactionSigner): Promise<Instruction> {
  return getOwnerRevokeOperatorInstructionAsync({ owner, ...(await emit()) });
}

export async function unpauseIx(owner: TransactionSigner): Promise<Instruction> {
  return getOwnerUnpauseInstructionAsync({ owner, ...(await emit()) });
}

/** The owner or the operator signs; `owner` names the desk. */
export async function pauseIx(signer: TransactionSigner, owner: Address): Promise<Instruction> {
  return getPauseInstructionAsync({ signer, owner, ...(await emit()) });
}

export async function checkpointIx(operator: TransactionSigner, owner: Address, deadlineSec: number, decisionHash: Hash32): Promise<Instruction> {
  return getOperatorCheckpointInstructionAsync({ operator, owner, deadlineSec: BigInt(deadlineSec), decisionHash: hashArg(decisionHash), ...(await emit()) });
}

export interface SwapIxInput {
  operator: TransactionSigner;
  owner: Address;
  tokenMint: Address;
  /** USDC E6 for a buy; raw tokens for a sell. */
  amountIn: bigint;
  minOut: bigint;
  deadlineSec: number;
  decisionHash: Hash32;
  /** The router's instruction data, forwarded opaque. */
  swapData: Uint8Array;
  /** The router's accounts, in its order; no signer flags (the program flags the desk PDA on the CPI). */
  route: readonly AccountMeta[];
  /** A Pyth `PriceUpdateV2` for the name's index feed, when the desk requires one. */
  priceUpdate?: Address;
  usdcMint?: Address;
  swapProgram?: Address;
}

async function withRoute(instruction: Instruction, route: readonly AccountMeta[]): Promise<Instruction> {
  return { ...instruction, accounts: [...(instruction.accounts ?? []), ...route] };
}

export async function buyIx(i: SwapIxInput): Promise<Instruction> {
  const ix = await getOperatorBuyInstructionAsync({
    operator: i.operator, owner: i.owner, usdcMint: i.usdcMint ?? USDC_MAINNET, tokenMint: i.tokenMint, swapProgram: i.swapProgram ?? JUPITER_V6,
    usdcTokenProgram: TOKEN_PROGRAM, tokenProgram: TOKEN_2022_PROGRAM, priceUpdate: i.priceUpdate,
    usdcIn: i.amountIn, minTokenOut: i.minOut, deadlineSec: BigInt(i.deadlineSec), decisionHash: hashArg(i.decisionHash), swapData: i.swapData, ...(await emit()),
  });
  return withRoute(ix, i.route);
}

export async function sellIx(i: SwapIxInput): Promise<Instruction> {
  const ix = await getOperatorSellInstructionAsync({
    operator: i.operator, owner: i.owner, usdcMint: i.usdcMint ?? USDC_MAINNET, tokenMint: i.tokenMint, swapProgram: i.swapProgram ?? JUPITER_V6,
    usdcTokenProgram: TOKEN_PROGRAM, tokenProgram: TOKEN_2022_PROGRAM, priceUpdate: i.priceUpdate,
    tokenIn: i.amountIn, minUsdcOut: i.minOut, deadlineSec: BigInt(i.deadlineSec), decisionHash: hashArg(i.decisionHash), swapData: i.swapData, ...(await emit()),
  });
  return withRoute(ix, i.route);
}

export async function initReferenceIx(payer: TransactionSigner, mint: Address): Promise<Instruction> {
  return getPublicInitReferenceInstructionAsync({ payer, mint, ...(await emit()) });
}

export interface PostReferenceIxInput {
  payer: TransactionSigner;
  mint: Address;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
}

/** The post itself; `reference.ts` pairs it with the ed25519 instruction that must sit immediately before it. */
export async function postReferenceIx(i: PostReferenceIxInput): Promise<Instruction> {
  return getPublicPostReferenceInstructionAsync({ payer: i.payer, mint: i.mint, tokenPriceE8: i.tokenPriceE8, markPriceE8: i.markPriceE8, multiplierE12: i.multiplierE12, fetchedAtSec: BigInt(i.fetchedAtSec), ...(await emit()) });
}

export interface InitConfigInput {
  admin: TransactionSigner;
  usdcMint: Address;
  swapProgram: Address;
  clusterTag: number;
  attestors: readonly Address[];
}

const NO_KEY = address("11111111111111111111111111111111");
const BPF_LOADER_UPGRADEABLE = address("BPFLoaderUpgradeab1e11111111111111111111111");
const four = (attestors: readonly Address[]): Address[] => [...attestors.slice(0, 4), ...Array<Address>(Math.max(0, 4 - attestors.length)).fill(NO_KEY)];

export async function initConfigIx(i: InitConfigInput): Promise<Instruction> {
  const [programData] = await getProgramDerivedAddress({ programAddress: BPF_LOADER_UPGRADEABLE, seeds: [getAddressEncoder().encode(AGARI_DESK_PROGRAM_ADDRESS)] });
  return getAdminInitConfigInstructionAsync({ admin: i.admin, usdcMint: i.usdcMint, swapProgram: i.swapProgram, program: AGARI_DESK_PROGRAM_ADDRESS, programData, clusterTag: i.clusterTag, attestors: four(i.attestors) });
}

export async function setAttestorsIx(admin: TransactionSigner, attestors: readonly Address[]): Promise<Instruction> {
  return getAdminSetAttestorsInstruction({ admin, attestors: four(attestors), ...(await emit()) });
}

export async function setReferenceFeedIx(admin: TransactionSigner, mint: Address, pythFeedId: Hash32): Promise<Instruction> {
  return getAdminSetReferenceFeedInstructionAsync({ admin, mint, pythFeedId: hashArg(pythFeedId), ...(await emit()) });
}
