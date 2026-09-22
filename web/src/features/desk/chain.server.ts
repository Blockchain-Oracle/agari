import { addressSchema, type Address } from "@agari/core/types";
import { createDeskRpc, deskAddress, readDeskState, readSealsOf, type DeskRpc, type SealedAction } from "@agari/markets/desk";
import { heliusMainnetUrl } from "@agari/markets/holdings";
import type { ChainStateWire } from "./protocol";

/**
 * The server's own mainnet reads for the desk routes (D-126): a live desk's on-chain state beside the index's rows,
 * and the seal a transaction carries. The Helius key is read here and spent upstream; a deployment without it
 * answers `chain: null, chainError` and every surface says the chain was not read, never a guessed figure.
 */
const CHAIN_NOT_CONFIGURED = "mainnet reads are not configured on this deployment";
/** Core's branded `Address`/`Signature` and Kit's are the same base58 text under different brands; the web never imports Kit's. */
type KitAddress = Parameters<typeof readDeskState>[1];
type KitSignature = Parameters<typeof readSealsOf>[1];

export function mainnetRpc(): DeskRpc | null {
  const explicit = process.env.SOLANA_MAINNET_RPC_URL;
  const key = process.env.HELIUS_API_KEY;
  const url = explicit ?? (key ? heliusMainnetUrl(key) : null);
  return url ? createDeskRpc(url) : null;
}

/** The venue's desk-runner key every desk is opened with (`DESK_OPERATOR_ADDRESS`), or null when unset or malformed. */
export function operatorAddress(): string | null {
  const parsed = addressSchema.safeParse(process.env.DESK_OPERATOR_ADDRESS?.trim());
  return parsed.success ? parsed.data : null;
}

export async function readChain(owner: Address, nowSec: number): Promise<{ state: ChainStateWire | null; error: string | null }> {
  const rpc = mainnetRpc();
  if (!rpc) return { state: null, error: CHAIN_NOT_CONFIGURED };
  try {
    const s = await readDeskState(rpc, owner as unknown as KitAddress, nowSec);
    if (!s) return { state: null, error: null };
    return {
      state: {
        address: s.address, operator: s.operator, seq: s.seq.toString(), head: s.head, perActionCapE6: s.perActionCapE6.toString(), dailyCapE6: s.dailyCapE6.toString(),
        spentInWindowE6: s.spentInWindowE6.toString(), remainingDailyCapE6: s.remainingDailyCapE6.toString(), maxPremiumBps: s.maxPremiumBps, mode: s.mode, paused: s.paused,
        usdcRaw: s.usdc.raw.toString(), tokens: s.tokens.map((t) => ({ symbol: t.symbol, mint: t.mint, raw: t.raw.toString(), enabled: t.enabled, frozen: t.frozen, exists: t.exists })), slot: s.slot.toString(),
      },
      error: null,
    };
  } catch (error) {
    // Never the message: a failed fetch quotes the URL, and the URL carries the key.
    return { state: null, error: `the chain could not be read (${error instanceof Error ? error.name : "unknown"})` };
  }
}

/** True when a desk PDA for `owner` exists on mainnet with exactly this address and operator (the attach check). */
export async function chainMatches(owner: Address, address: string, operator: string, nowSec: number): Promise<boolean | null> {
  const rpc = mainnetRpc();
  if (!rpc) return null;
  try {
    const kitOwner = owner as unknown as KitAddress;
    const [pda, state] = await Promise.all([deskAddress(kitOwner), readDeskState(rpc, kitOwner, nowSec)]);
    return state !== null && (pda as string) === address && state.operator === operator;
  } catch {
    return null;
  }
}

export async function sealsOf(signature: string): Promise<SealedAction[] | null> {
  const rpc = mainnetRpc();
  if (!rpc) return null;
  try {
    return await readSealsOf(rpc, signature as unknown as KitSignature);
  } catch {
    return null;
  }
}
