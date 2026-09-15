import type { Address } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";
import { marketsEnvInputFrom, parseMarketsEnv, resolveVaultDeployment, type MarketsEnv } from "@agari/markets";
import { keypairAddress } from "@agari/markets/sessions";
import { sponsorLimitsFrom, sponsorRoleSecret } from "@agari/markets/sponsor";

/**
 * Server env for the sponsor routes. The fee-payer co-sign itself (policy, key, ledger) lives in
 * `@agari/markets/sponsor` (tap-trading.md §3, D-065); what stays here is the shared env mapping and the games'
 * view of the same `sponsor` role (S12), which shares the key and the hourly gates but not the co-sign policy.
 */

/** The chain-port config from server env, through the one name map markets owns (so no field, like the vault id, is dropped). */
export function marketsEnvFromProcess(): MarketsEnv {
  return parseMarketsEnv(marketsEnvInputFrom(process.env));
}

export function vaultDeploymentFromProcess(env: MarketsEnv): VaultDeployment | null {
  return resolveVaultDeployment(env);
}

/** The games' view of the shared `sponsor` role (S12): its key, RPC and the Masayume hourly gates. */
export interface SponsorConfig {
  /** The sponsor's 64-byte Solana keypair. Server-only. */
  secretKey: Uint8Array;
  rpcUrl: string;
  sponsor: Address;
  maxPerAddressPerHour: number;
  maxPerDevicePerHour: number;
  /** Compute-unit ceiling on any sponsored transaction (never above the plan's 400k). */
  maxComputeUnits: number;
}

export function sponsorConfig(env: MarketsEnv): SponsorConfig | null {
  const secretKey = sponsorRoleSecret(process.env);
  if (!secretKey) return null;
  const limits = sponsorLimitsFrom(process.env);
  return {
    secretKey,
    rpcUrl: process.env.SPONSOR_RPC_URL || (env.rpcHttpUrls[0] as string),
    sponsor: keypairAddress(secretKey),
    maxPerAddressPerHour: limits.signerPerHour,
    maxPerDevicePerHour: limits.devicePerHour,
    maxComputeUnits: limits.maxComputeUnits,
  };
}

export type GateVerdict = { ok: true } | { ok: false; reason: string };

const HOUR_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

/** A sliding hour per key for the non-co-sign routes (games, private opens); ids are kept exactly as given (base58, D-010). */
export function gate(scope: "address" | "device", id: string, max: number, nowMs: number): GateVerdict {
  if (!id) return { ok: false, reason: `no ${scope} to gate on — the sponsor refuses rather than guess` };
  const key = `${scope}:${id}`;
  const recent = (hits.get(key) ?? []).filter((at) => nowMs - at < HOUR_MS);
  if (recent.length >= max) return { ok: false, reason: `over the sponsor's ${max}-per-hour ${scope} cap` };
  recent.push(nowMs);
  hits.set(key, recent);
  return { ok: true };
}
