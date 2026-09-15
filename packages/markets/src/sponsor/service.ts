/**
 * The sponsor as the route sees it (tap-trading.md §3, D-065): the `sponsor` role key, its RPC, the limits and the
 * co-sign ledger behind two calls, `status()` and `cosign()`. The key is `SPONSOR_PRIVATE_KEY`, else
 * `~/.config/agari/devnet/sponsor.json` (`AGARI_KEYS_DIR`), as D-034; Kit imports it non-extractable after checking the
 * public half, and its bytes are never logged or returned. Server-only.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { COMPUTE_UNIT_LIMIT_MAX } from "@agari/core/constants";
import type { Address as CoreAddress } from "@agari/core/types";
import { VAULT_NOT_DEPLOYED } from "@agari/core/vault";
import { createKeyPairFromBytes, type Address } from "@solana/kit";
import { DEVNET_DEFAULTS } from "../env";
import { keypairAddress, parseSecretKey } from "../sessions/keypair";
import { createSponsorRpc, type SponsorRpc } from "./chain";
import { cosign, type CosignAccepted, type SponsorKeyPair, type SponsorLimits } from "./cosign";
import { BREAKER_REASON, breakerOpen, createAttemptLimiter, createLocalLedger, type SponsorLedger } from "./gates";
import { refuse, type Refusal } from "./policy";
import { SPONSOR_ALLOWLIST, type SponsorStatus } from "./status";

type Env = Record<string, string | undefined>;

export const NO_SPONSOR_KEY = "no sponsor key on this server; the session key pays its own fee";

const count = (env: Env, name: string, fallback: number) => (env[name] && /^\d{1,9}$/.test(env[name]!) ? Number(env[name]) : fallback);
const lamports = (env: Env, name: string, fallback: bigint) => (env[name] && /^\d{1,19}$/.test(env[name]!) ? BigInt(env[name]!) : fallback);

/** The spec's limits (tap-trading.md §3), each overridable by its `SPONSOR_*` variable (`web/.env.example`). */
export function sponsorLimitsFrom(env: Env): SponsorLimits {
  return {
    signerPerHour: count(env, "SPONSOR_PER_ADDRESS_PER_HOUR", 30),
    devicePerHour: count(env, "SPONSOR_PER_DEVICE_PER_HOUR", 60),
    deviceDailyLamports: lamports(env, "SPONSOR_DEVICE_DAILY_LAMPORTS", 5_000_000n),
    dailyLamports: lamports(env, "SPONSOR_DAILY_LAMPORTS", 500_000_000n),
    minBalanceLamports: lamports(env, "SPONSOR_MIN_BALANCE_LAMPORTS", 200_000_000n),
    maxFeeLamports: lamports(env, "SPONSOR_MAX_FEE_LAMPORTS", 10_000n),
    maxComputeUnits: Math.min(count(env, "SPONSOR_MAX_COMPUTE_UNITS", COMPUTE_UNIT_LIMIT_MAX), COMPUTE_UNIT_LIMIT_MAX),
    maxMicroLamports: lamports(env, "SPONSOR_MAX_MICRO_LAMPORTS", 0n),
    attemptsPerDevicePerMinute: count(env, "SPONSOR_ATTEMPTS_PER_DEVICE_PER_MINUTE", 20),
    attemptsPerIpPerMinute: count(env, "SPONSOR_ATTEMPTS_PER_IP_PER_MINUTE", 60),
  };
}

/** The role's 64-byte keypair: `SPONSOR_PRIVATE_KEY`, else the role file. Null when neither parses. */
export function sponsorRoleSecret(env: Env): Uint8Array | null {
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

/** The route's two calls; `vaultProgram` is the resolved deployment's program id, null while agari-vault is not deployed. */
export interface SponsorService {
  status(vaultProgram: CoreAddress | null): Promise<SponsorStatus>;
  /** `ip` is the route's first `x-forwarded-for` hop, "" when absent. */
  cosign(vaultProgram: CoreAddress | null, body: unknown, device: string, ip: string): Promise<CosignAccepted | Refusal>;
}

interface Loaded {
  sponsor: Address;
  keyPair: SponsorKeyPair;
}

/** One per process: the key is read and imported once; `rpc` and `ledger` are injectable for tests and lane 7b's store. */
export function createSponsorService(env: Env, deps: { rpc?: SponsorRpc; ledger?: SponsorLedger; nowMs?: () => number } = {}): SponsorService {
  const limits = sponsorLimitsFrom(env);
  const rpc = deps.rpc ?? createSponsorRpc(env.SPONSOR_RPC_URL || DEVNET_DEFAULTS.rpcHttpUrls[0]);
  // The `sponsor_cosigns` store replaces these in-process counters when it exists.
  const ledger = deps.ledger ?? createLocalLedger();
  const attempts = createAttemptLimiter();
  let loaded: Promise<Loaded | null> | null = null;
  const load = () =>
    (loaded ??= (async () => {
      const secret = sponsorRoleSecret(env);
      if (!secret) return null;
      try {
        return { sponsor: keypairAddress(secret) as string as Address, keyPair: await createKeyPairFromBytes(secret) };
      } catch {
        return null;
      } finally {
        secret.fill(0);
      }
    })());

  return {
    async status(vaultProgram) {
      const base = { allowlist: SPONSOR_ALLOWLIST, sponsor: null, balanceLamports: null };
      const key = await load();
      if (!key) return { ...base, configured: false, reason: NO_SPONSOR_KEY };
      const sponsor = key.sponsor as string as SponsorStatus["sponsor"];
      if (!vaultProgram) return { ...base, sponsor, configured: false, reason: VAULT_NOT_DEPLOYED };
      const balance = await rpc.getBalance(key.sponsor).catch(() => null);
      if (balance === null) return { ...base, sponsor, configured: false, reason: "the sponsor's balance could not be read" };
      if (breakerOpen(balance, limits)) return { ...base, sponsor, balanceLamports: balance, configured: false, reason: BREAKER_REASON };
      return { ...base, sponsor, balanceLamports: balance, configured: true, ...(ledger.kind === "local" ? { reason: "local counters" } : {}) };
    },
    async cosign(vaultProgram, body, device, ip) {
      const key = await load();
      if (!key) return refuse(503, NO_SPONSOR_KEY);
      if (!vaultProgram) return refuse(503, VAULT_NOT_DEPLOYED);
      return cosign({ ...key, vaultProgram: vaultProgram as string as Address, limits, rpc, ledger, attempts, nowMs: deps.nowMs ?? Date.now }, { body, device, ip });
    },
  };
}
