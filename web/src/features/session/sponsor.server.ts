import { addressSchema, hexSchema, type Address, type Hex } from "@masayume/core/types";
import type { VaultDeployment } from "@masayume/core/vault";
import { FORWARD_DEADLINE_SEC, parseMarketsEnv, resolveVaultDeployment, SPONSOR_MAX_GAS, sponsorAddressOf, type MarketsEnv } from "@masayume/markets";
import { z } from "zod";

/**
 * The sponsor's policy, server-side (AD-15): what it pays for, for whom, how often.
 * Gates are per address and per device and degrade closed — no device id, no sponsorship.
 * The counters live in this process; a multi-instance deploy would count per instance until
 * the store-backed `sponsor_gates` table exists (AD-7).
 */
export interface SponsorConfig {
  privateKey: Hex;
  rpcUrl: string;
  sponsor: Address;
  maxPerAddressPerHour: number;
  maxPerDevicePerHour: number;
  maxGas: bigint;
}

const DEFAULT_PER_ADDRESS = 30;
const DEFAULT_PER_DEVICE = 60;
const WINDOW_MS = 60 * 60 * 1000;
const DEADLINE_SLACK_SEC = 60;

export function marketsEnvFromProcess(): MarketsEnv {
  return parseMarketsEnv({
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
    indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL,
    rpcWsUrls: process.env.NEXT_PUBLIC_RPC_WS_URLS,
    rpcHttpUrls: process.env.NEXT_PUBLIC_RPC_HTTP_URLS,
    venueId: process.env.NEXT_PUBLIC_VENUE_ID,
    eventVaultAddress: process.env.NEXT_PUBLIC_EVENT_VAULT_ADDRESS,
    forwarderAddress: process.env.NEXT_PUBLIC_FORWARDER_ADDRESS,
    eventVaultFromBlock: process.env.NEXT_PUBLIC_EVENT_VAULT_FROM_BLOCK,
  });
}

export function vaultDeploymentFromProcess(env: MarketsEnv): VaultDeployment | null {
  return resolveVaultDeployment(env);
}

function intEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Null when no `SPONSOR_PRIVATE_KEY` is set — the route then says so and every key pays for itself. */
export function sponsorConfig(env: MarketsEnv): SponsorConfig | null {
  const raw = process.env.SPONSOR_PRIVATE_KEY;
  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) return null;
  const privateKey = raw as Hex;
  const maxGasRaw = process.env.SPONSOR_MAX_GAS;
  return {
    privateKey,
    rpcUrl: process.env.SPONSOR_RPC_URL || (env.rpcHttpUrls[0] as string),
    sponsor: sponsorAddressOf(privateKey),
    maxPerAddressPerHour: intEnv("SPONSOR_PER_ADDRESS_PER_HOUR", DEFAULT_PER_ADDRESS),
    maxPerDevicePerHour: intEnv("SPONSOR_PER_DEVICE_PER_HOUR", DEFAULT_PER_DEVICE),
    maxGas: maxGasRaw && /^\d+$/.test(maxGasRaw) ? BigInt(maxGasRaw) : SPONSOR_MAX_GAS,
  };
}

export const forwardRequestSchema = z.object({
  from: addressSchema,
  to: addressSchema,
  value: z.string().regex(/^\d+$/),
  gas: z.string().regex(/^\d+$/),
  deadlineSec: z.number().int().nonnegative(),
  data: hexSchema,
  signature: hexSchema,
});

export type GateVerdict = { ok: true } | { ok: false; reason: string };

const hits = new Map<string, number[]>();

/** A sliding hour per key; anything over the cap is refused with the cap in words. */
export function gate(scope: "address" | "device", id: string, max: number, nowMs: number): GateVerdict {
  if (!id) return { ok: false, reason: `no ${scope} to gate on — the sponsor refuses rather than guess` };
  const key = `${scope}:${id.toLowerCase()}`;
  const recent = (hits.get(key) ?? []).filter((at) => nowMs - at < WINDOW_MS);
  if (recent.length >= max) return { ok: false, reason: `over the sponsor's ${max}-per-hour ${scope} cap` };
  recent.push(nowMs);
  hits.set(key, recent);
  return { ok: true };
}

export function deadlineIsSane(deadlineSec: number, nowSec: number): boolean {
  return deadlineSec >= nowSec && deadlineSec <= nowSec + FORWARD_DEADLINE_SEC + DEADLINE_SLACK_SEC;
}
