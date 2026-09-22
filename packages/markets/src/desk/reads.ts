/**
 * Desk reads (desk.md §2) through an explicit mainnet RPC: the config, an owner's desk with its two kinds of token
 * account (USDC and the allowed names), every name's venue reference, and the Token-2022 mint flags the pre-gate
 * needs (the effective ScaledUiAmount multiplier, paused). Two RPC calls per desk: one base64 batch for the accounts,
 * one jsonParsed batch for the mints. Integers throughout; the mint's f64 is read as decimal text and floored.
 */
import { getDeskConfigDecoder, getDeskDecoder, getDeskRefDecoder } from "@agari/clients/agari-desk";
import { deskModeOf, effectiveMultiplierE12, type DeskMode, type ScaledUiAmountState } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import type { Hash32 } from "@agari/core/types";
import { getBase64Encoder, type Address, type Base64EncodedDataResponse, type Rpc, type SolanaRpcApi } from "@solana/kit";
import { z } from "zod";
import { associatedTokenAddress, deskAddress, deskConfigAddress, deskRefAddress, deskSymbolOfMint, TOKEN_2022_PROGRAM, TOKEN_PROGRAM } from "./deployment";

export type DeskRpc = Rpc<SolanaRpcApi>;
const NO_KEY = "11111111111111111111111111111111";
/** Token account layout: `amount` u64 at 64, `state` u8 at 108 (1 initialized, 2 frozen). */
const AMOUNT_AT = 64;
const STATE_AT = 108;
const FROZEN = 2;

export interface DeskConfigState {
  address: Address;
  admin: Address;
  usdcMint: Address;
  swapProgram: Address;
  attestors: Address[];
  clusterTag: number;
}

export interface DeskTokenAccountState {
  address: Address;
  exists: boolean;
  raw: bigint;
  frozen: boolean;
}

export interface DeskAllowedToken extends DeskTokenAccountState {
  mint: Address;
  symbol: PreIpoSymbol | null;
  enabled: boolean;
}

export interface DeskRefState {
  mint: Address;
  tokenPriceE8: bigint;
  markPriceE8: bigint;
  multiplierE12: bigint;
  fetchedAtSec: number;
  postedBy: Address;
  pythFeedId: Hash32 | null;
}

export interface DeskMintState {
  mint: Address;
  decimals: number;
  /** The effective ScaledUiAmount multiplier now; null when the mint could not be read exactly. */
  multiplierE12: bigint | null;
  paused: boolean | null;
}

export interface DeskState {
  address: Address;
  owner: Address;
  operator: Address | null;
  seq: bigint;
  head: Hash32;
  perActionCapE6: bigint;
  dailyCapE6: bigint;
  spentInWindowE6: bigint;
  windowStartSec: number;
  remainingDailyCapE6: bigint;
  maxPremiumBps: number;
  mode: DeskMode;
  paused: boolean;
  requirePythIndex: boolean;
  usdc: DeskTokenAccountState;
  tokens: DeskAllowedToken[];
  refs: Record<string, DeskRefState>;
  mints: Record<string, DeskMintState>;
  slot: bigint;
}

const hex = (bytes: ArrayLike<number>): Hash32 => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

async function loadMany(rpc: DeskRpc, addresses: readonly Address[]): Promise<{ slot: bigint; bytes: (Uint8Array | null)[] }> {
  if (addresses.length === 0) return { slot: 0n, bytes: [] };
  const { context, value } = await rpc.getMultipleAccounts(addresses, { encoding: "base64", commitment: "confirmed" }).send();
  const encoder = getBase64Encoder();
  return { slot: context.slot, bytes: value.map((account) => (account ? (encoder.encode((account.data as Base64EncodedDataResponse)[0]) as Uint8Array) : null)) };
}

function tokenAccountState(address: Address, bytes: Uint8Array | null): DeskTokenAccountState {
  if (!bytes || bytes.length < STATE_AT + 1) return { address, exists: false, raw: 0n, frozen: false };
  const raw = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(AMOUNT_AT, true);
  return { address, exists: true, raw, frozen: bytes[STATE_AT] === FROZEN };
}

function refState(bytes: Uint8Array): DeskRefState {
  const r = getDeskRefDecoder().decode(bytes);
  const feed = hex(r.pythFeedId);
  return { mint: r.mint, tokenPriceE8: r.tokenPriceE8, markPriceE8: r.markPriceE8, multiplierE12: r.multiplierE12, fetchedAtSec: Number(r.fetchedAtSec), postedBy: r.postedBy, pythFeedId: /^0x0+$/.test(feed) ? null : feed };
}

export async function readDeskConfig(rpc: DeskRpc): Promise<DeskConfigState | null> {
  const address = await deskConfigAddress();
  const { bytes } = await loadMany(rpc, [address]);
  const data = bytes[0];
  if (!data) return null;
  const c = getDeskConfigDecoder().decode(data);
  return { address, admin: c.admin, usdcMint: c.usdcMint, swapProgram: c.swapProgram, attestors: c.attestors.filter((a) => (a as string) !== NO_KEY), clusterTag: c.clusterTag };
}

/** The venue references of `mints` that exist, keyed by mint. */
export async function readDeskRefs(rpc: DeskRpc, mints: readonly Address[]): Promise<Record<string, DeskRefState>> {
  const addresses = await Promise.all(mints.map(deskRefAddress));
  const { bytes } = await loadMany(rpc, addresses);
  const out: Record<string, DeskRefState> = {};
  bytes.forEach((data, i) => {
    if (data) out[mints[i] as string] = refState(data);
  });
  return out;
}

const scaledSchema = z.object({ multiplier: z.string(), newMultiplier: z.string(), newMultiplierEffectiveTimestamp: z.number().int() });
const pausableSchema = z.object({ paused: z.boolean() });
const mintsSchema = z.object({
  value: z.array(
    z.object({ data: z.object({ parsed: z.object({ info: z.object({ decimals: z.number().int(), extensions: z.array(z.object({ extension: z.string(), state: z.unknown() })).optional() }) }) }) }).nullable(),
  ),
});

/** The Token-2022 flags of `mints`: the effective multiplier (Token-2022's own switch-over rule) and `paused`. */
export async function readDeskMints(rpc: DeskRpc, mints: readonly Address[], nowSec: number): Promise<Record<string, DeskMintState>> {
  if (mints.length === 0) return {};
  const parsed = mintsSchema.parse(await rpc.getMultipleAccounts(mints, { encoding: "jsonParsed", commitment: "confirmed" }).send());
  const out: Record<string, DeskMintState> = {};
  parsed.value.forEach((account, i) => {
    const mint = mints[i] as Address;
    if (!account) return;
    const extensions = account.data.parsed.info.extensions ?? [];
    const scaled = extensions.find((e) => e.extension === "scaledUiAmountConfig");
    const pausable = extensions.find((e) => e.extension === "pausableConfig");
    const scaledState = scaled ? scaledSchema.safeParse(scaled.state) : null;
    const pausedState = pausable ? pausableSchema.safeParse(pausable.state) : null;
    const state: ScaledUiAmountState | null = scaledState?.success ? scaledState.data : null;
    out[mint as string] = {
      mint,
      decimals: account.data.parsed.info.decimals,
      multiplierE12: scaledState && !scaledState.success ? null : effectiveMultiplierE12(state, nowSec),
      paused: pausable ? (pausedState?.success ? pausedState.data.paused : null) : false,
    };
  });
  return out;
}

/** An owner's desk, or null when they never opened one. `nowSec` sizes what is left of today's cap. */
export async function readDeskState(rpc: DeskRpc, owner: Address, nowSec: number, usdcMint?: Address): Promise<DeskState | null> {
  const [address, config] = await Promise.all([deskAddress(owner), readDeskConfig(rpc)]);
  if (!config) return null;
  const collateral = usdcMint ?? config.usdcMint;
  const { bytes: deskBytes } = await loadMany(rpc, [address]);
  const data = deskBytes[0];
  if (!data) return null;
  const d = getDeskDecoder().decode(data);
  const slots = d.tokens.filter((t) => (t.mint as string) !== NO_KEY);
  const mints = slots.map((t) => t.mint);
  const [usdcAta, atas, refAddresses] = await Promise.all([
    associatedTokenAddress(address, collateral, TOKEN_PROGRAM),
    Promise.all(mints.map((mint) => associatedTokenAddress(address, mint, TOKEN_2022_PROGRAM))),
    Promise.all(mints.map(deskRefAddress)),
  ]);
  const [{ slot, bytes }, mintStates] = await Promise.all([loadMany(rpc, [usdcAta, ...atas, ...refAddresses]), readDeskMints(rpc, mints, nowSec)]);
  const refs: Record<string, DeskRefState> = {};
  refAddresses.forEach((_, i) => {
    const raw = bytes[1 + atas.length + i];
    if (raw) refs[mints[i] as string] = refState(raw);
  });
  const windowStartSec = Number(d.windowStartSec);
  const windowOver = nowSec >= windowStartSec + 86_400;
  return {
    address,
    owner: d.owner,
    operator: (d.operator as string) === NO_KEY ? null : d.operator,
    seq: d.seq,
    head: hex(d.head),
    perActionCapE6: d.perActionCap,
    dailyCapE6: d.dailyCap,
    spentInWindowE6: d.spentInWindow,
    windowStartSec,
    remainingDailyCapE6: windowOver ? d.dailyCap : d.dailyCap > d.spentInWindow ? d.dailyCap - d.spentInWindow : 0n,
    maxPremiumBps: d.maxPremiumBps,
    mode: deskModeOf(d.mode) ?? "practice",
    paused: d.paused !== 0,
    requirePythIndex: d.requirePythIndex !== 0,
    usdc: tokenAccountState(usdcAta, bytes[0] ?? null),
    tokens: slots.map((t, i) => ({ ...tokenAccountState(atas[i] as Address, bytes[1 + i] ?? null), mint: t.mint, symbol: deskSymbolOfMint(t.mint), enabled: t.enabled !== 0 })),
    refs,
    mints: mintStates,
    slot,
  };
}
