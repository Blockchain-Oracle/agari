import { COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import type { Address } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";
import { keypairAddress, parseMarketsEnv, parseSecretKey, resolveVaultDeployment, type MarketsEnv } from "@agari/markets";

/**
 * The sponsor's policy, server-side (AD-15, plan §3.2): on Solana the sponsor is a fee-payer co-signer that signs a
 * transaction only as its fee payer, for an allowlist of exact instruction discriminators, and never as any other
 * signer or writable account. The co-sign rail itself arrives with the vault program (S7); this module keeps the
 * parts that don't need the chain: the key, the caps and the per-address and per-device gates.
 *
 * Gates degrade closed (no device id, no sponsorship). The counters live in this process; a multi-instance deploy
 * would count per instance until the store-backed `sponsor_gates` table exists (AD-7).
 */
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

const DEFAULT_PER_ADDRESS = 30;
const DEFAULT_PER_DEVICE = 60;
const WINDOW_MS = 60 * 60 * 1000;

/** The chain-port config from server env. Server code reads process env at runtime, so no literal-name inlining is needed. */
export function marketsEnvFromProcess(): MarketsEnv {
  return parseMarketsEnv({
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
    rpcHttpUrls: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    rpcWsUrls: process.env.NEXT_PUBLIC_SOLANA_WS_URL,
    indexerUrl: process.env.NEXT_PUBLIC_AGARI_INDEXER_URL,
    venueId: process.env.NEXT_PUBLIC_AGARI_VENUE_ID,
    eventsProgramId: process.env.NEXT_PUBLIC_AGARI_EVENTS_PROGRAM_ID,
  });
}

export function vaultDeploymentFromProcess(env: MarketsEnv): VaultDeployment | null {
  return resolveVaultDeployment(env);
}

function intEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Null when no valid `SPONSOR_PRIVATE_KEY` (Solana keypair: CLI JSON array or base58) is set; every key then pays its own fees. */
export function sponsorConfig(env: MarketsEnv): SponsorConfig | null {
  const raw = process.env.SPONSOR_PRIVATE_KEY;
  if (!raw) return null;
  let secretKey: Uint8Array;
  try {
    secretKey = parseSecretKey(raw);
  } catch {
    return null;
  }
  return {
    secretKey,
    rpcUrl: process.env.SPONSOR_RPC_URL || (env.rpcHttpUrls[0] as string),
    sponsor: keypairAddress(secretKey),
    maxPerAddressPerHour: intEnv("SPONSOR_PER_ADDRESS_PER_HOUR", DEFAULT_PER_ADDRESS),
    maxPerDevicePerHour: intEnv("SPONSOR_PER_DEVICE_PER_HOUR", DEFAULT_PER_DEVICE),
    maxComputeUnits: Math.min(intEnv("SPONSOR_MAX_COMPUTE_UNITS", COMPUTE_UNIT_LIMIT_MAX), COMPUTE_UNIT_LIMIT_MAX),
  };
}

export type GateVerdict = { ok: true } | { ok: false; reason: string };

const hits = new Map<string, number[]>();

/** A sliding hour per key; anything over the cap is refused with the cap in words. Ids are kept exactly as given (base58, D-010). */
export function gate(scope: "address" | "device", id: string, max: number, nowMs: number): GateVerdict {
  if (!id) return { ok: false, reason: `no ${scope} to gate on — the sponsor refuses rather than guess` };
  const key = `${scope}:${id}`;
  const recent = (hits.get(key) ?? []).filter((at) => nowMs - at < WINDOW_MS);
  if (recent.length >= max) return { ok: false, reason: `over the sponsor's ${max}-per-hour ${scope} cap` };
  recent.push(nowMs);
  hits.set(key, recent);
  return { ok: true };
}
