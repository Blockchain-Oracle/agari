/**
 * The desk runner's environment (S21 C4, plan §8), read once at boot. The desk is a mainnet product: its RPC is its
 * own (`DESK_RPC_URL`, else Helius mainnet from `HELIUS_API_KEY`), never the venue's devnet endpoint. A missing key
 * means read-and-record only for live desks; practice desks need no key at all.
 */
import type { DeskCluster } from "@agari/db";
import { roleSecret } from "../../runtime/keys";

export interface DeskRunnerEnv {
  /** `desk-runner`: the operator role's 64-byte keypair; null means nothing is sent. */
  operatorSecret: Uint8Array | null;
  /** `price-attestor`: signs the venue reference the program measures against; null means references are never refreshed here. */
  attestorSecret: Uint8Array | null;
  /** May carry a provider key. Never log it. */
  rpcUrl: string;
  cluster: DeskCluster;
  intervalMs: number;
  maxModelCallsPerHour: number;
  modelTimeoutMs: number;
  aiModel: string | undefined;
  jupiterApiKey: string | undefined;
  dryRun: boolean;
}

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MAX_CALLS_PER_HOUR = 12;
const DEFAULT_MODEL_TIMEOUT_MS = 45_000;

function intEnv(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const value = Number(env[name]);
  return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
}

/** `DESK_CLUSTER=localnet` runs the desk against a Surfpool mainnet fork (the C6 rehearsal); mainnet otherwise. */
function clusterOf(env: NodeJS.ProcessEnv): DeskCluster {
  return env.DESK_CLUSTER === "localnet" ? "localnet" : env.DESK_CLUSTER === "devnet" ? "devnet" : "mainnet-beta";
}

export function deskRpcUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DESK_RPC_URL) return env.DESK_RPC_URL;
  if (clusterOf(env) === "localnet") return `http://127.0.0.1:${env.SURFPOOL_PORT ?? 8899}`;
  return env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}` : "https://api.mainnet-beta.solana.com";
}

export function readDeskRunnerEnv(env: NodeJS.ProcessEnv = process.env): DeskRunnerEnv {
  return {
    operatorSecret: roleSecret("desk-runner", env),
    attestorSecret: roleSecret("price-attestor", env),
    rpcUrl: deskRpcUrl(env),
    cluster: clusterOf(env),
    intervalMs: intEnv(env, "DESK_INTERVAL_MS", DEFAULT_INTERVAL_MS, 5_000),
    maxModelCallsPerHour: intEnv(env, "DESK_MAX_MODEL_CALLS_PER_HOUR", DEFAULT_MAX_CALLS_PER_HOUR, 1),
    modelTimeoutMs: intEnv(env, "DESK_MODEL_TIMEOUT_MS", DEFAULT_MODEL_TIMEOUT_MS, 1_000),
    aiModel: env.DESK_AI_MODEL?.trim() || undefined,
    jupiterApiKey: env.JUPITER_API_KEY?.trim() || undefined,
    dryRun: !(env.DRY_RUN === "0" || env.DRY_RUN === "false"),
  };
}
