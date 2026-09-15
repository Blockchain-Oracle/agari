import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import { decodeBase58, type Address } from "@agari/core/types";
import type { VaultDeployment } from "@agari/core/vault";
import { DEVNET_DEFAULTS, marketsEnvInputFrom, parseMarketsEnv, resolveVaultDeployment, type MarketsEnv } from "@agari/markets";
import { keypairAddress, parseSecretKey } from "@agari/markets/sessions";
import { createSponsorRpc, type SponsorRpc } from "./sponsor/chain";
import type { SponsorLimits, SponsorSigner } from "./sponsor/cosign";
import { createLocalLedger, type SponsorLedger } from "./sponsor/gates";

/**
 * The sponsor's server configuration (tap-trading.md §3, D-065): the `sponsor` role key, its RPC, the policy limits and
 * the co-sign ledger. The key is `SPONSOR_PRIVATE_KEY`, else `~/.config/agari/devnet/sponsor.json` (`AGARI_KEYS_DIR`),
 * as D-034; the co-signer imports it into WebCrypto as a non-extractable signing key and its bytes are never logged or
 * returned. The games route (S12) shares the role through `sponsorConfig` and `gate`, not this policy.
 */
export interface CosignConfig {
  sponsor: Address;
  signer: SponsorSigner;
  rpc: SponsorRpc;
  ledger: SponsorLedger;
  limits: SponsorLimits;
}

/** The chain-port config from server env, through the one name map markets owns (so no field, like the vault id, is dropped). */
export function marketsEnvFromProcess(): MarketsEnv {
  return parseMarketsEnv(marketsEnvInputFrom(process.env));
}

export function vaultDeploymentFromProcess(env: MarketsEnv): VaultDeployment | null {
  return resolveVaultDeployment(env);
}

function countEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  return raw && /^\d{1,9}$/.test(raw) ? Number(raw) : fallback;
}

function lamportsEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  return raw && /^\d{1,19}$/.test(raw) ? BigInt(raw) : fallback;
}

export function sponsorLimitsFromProcess(): SponsorLimits {
  return {
    signerPerHour: countEnv("SPONSOR_PER_ADDRESS_PER_HOUR", 30),
    devicePerHour: countEnv("SPONSOR_PER_DEVICE_PER_HOUR", 60),
    deviceDailyLamports: lamportsEnv("SPONSOR_DEVICE_DAILY_LAMPORTS", 5_000_000n),
    dailyLamports: lamportsEnv("SPONSOR_DAILY_LAMPORTS", 500_000_000n),
    minBalanceLamports: lamportsEnv("SPONSOR_MIN_BALANCE_LAMPORTS", 200_000_000n),
    maxFeeLamports: lamportsEnv("SPONSOR_MAX_FEE_LAMPORTS", 10_000n),
    maxComputeUnits: Math.min(countEnv("SPONSOR_MAX_COMPUTE_UNITS", COMPUTE_UNIT_LIMIT_MAX), COMPUTE_UNIT_LIMIT_MAX),
    maxMicroLamports: lamportsEnv("SPONSOR_MAX_MICRO_LAMPORTS", 0n),
  };
}

function sponsorSecret(env: Record<string, string | undefined>): Uint8Array | null {
  const read = (text: string | undefined) => {
    if (!text) return null;
    try {
      return parseSecretKey(text);
    } catch {
      return null;
    }
  };
  const fromEnv = read(env.SPONSOR_PRIVATE_KEY);
  if (fromEnv) return fromEnv;
  const file = join(env.AGARI_KEYS_DIR || join(homedir(), ".config", "agari", "devnet"), "sponsor.json");
  if (!existsSync(file)) return null;
  try {
    return read(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** PKCS#8 for an Ed25519 private key: a fixed 16-byte header, then the 32-byte seed (RFC 8410). */
const PKCS8_ED25519_HEADER = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
const PROBE = new TextEncoder().encode("agari sponsor key check");

/** A signer over a 64-byte Solana keypair; null unless the seed really signs for the public half it carries. */
export async function signerFromSecret(secretKey: Uint8Array): Promise<SponsorSigner | null> {
  try {
    const pkcs8 = new Uint8Array(PKCS8_ED25519_HEADER.length + 32);
    pkcs8.set(PKCS8_ED25519_HEADER, 0);
    pkcs8.set(secretKey.subarray(0, 32), PKCS8_ED25519_HEADER.length);
    const privateKey = await crypto.subtle.importKey("pkcs8", pkcs8, "Ed25519", false, ["sign"]);
    pkcs8.fill(0);
    const address = keypairAddress(secretKey);
    const publicKey = await crypto.subtle.importKey("raw", new Uint8Array(decodeBase58(address)!), "Ed25519", false, ["verify"]);
    const sign = async (message: Uint8Array) => new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, new Uint8Array(message)));
    if (!(await crypto.subtle.verify("Ed25519", publicKey, await sign(PROBE), PROBE))) return null;
    return { address, sign };
  } catch {
    return null;
  }
}

let loaded: Promise<CosignConfig | null> | null = null;

/** Read once per process. Null when no valid sponsor key exists: every key then pays its own fee and the GET says so. */
export function cosignConfig(): Promise<CosignConfig | null> {
  loaded ??= (async () => {
    const secret = sponsorSecret(process.env);
    const signer = secret ? await signerFromSecret(secret) : null;
    secret?.fill(0);
    if (!signer) return null;
    return {
      sponsor: signer.address as Address,
      signer,
      rpc: createSponsorRpc(process.env.SPONSOR_RPC_URL || DEVNET_DEFAULTS.rpcHttpUrls[0]),
      // The `sponsor_cosigns` store (packages/db, lane 7b) replaces these counters when DATABASE_URL is set.
      ledger: createLocalLedger(),
      limits: sponsorLimitsFromProcess(),
    };
  })();
  return loaded;
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
  const secretKey = sponsorSecret(process.env);
  if (!secretKey) return null;
  const limits = sponsorLimitsFromProcess();
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
