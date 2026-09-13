import type { Hex } from "@masayume/core/types";

export interface RunnerEnv {
  privateKey: Hex | null;
  strategyIds: bigint[];
  intervalMs: number;
  dryRun: boolean;
  venueId: string | undefined;
  /** The most model reads an agent runner makes in a sliding hour, across every strategy it runs. */
  agentMaxCallsPerHour: number;
  /** How long one model read may take before it is a hold. */
  agentTimeoutMs: number;
}

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_AGENT_MAX_CALLS_PER_HOUR = 60;
const DEFAULT_AGENT_TIMEOUT_MS = 20_000;

function intEnv(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const value = Number(env[name]);
  return Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
}

/** Read once at boot; a missing key or an empty strategy list is logged as "not configured", never guessed. */
export function readRunnerEnv(env: NodeJS.ProcessEnv = process.env): RunnerEnv {
  const key = env.RUNNER_PRIVATE_KEY;
  const ids = (env.STRATEGY_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => BigInt(s));
  return {
    privateKey: key && /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as Hex) : null,
    strategyIds: ids,
    intervalMs: intEnv(env, "RUNNER_INTERVAL_MS", DEFAULT_INTERVAL_MS, 5_000),
    dryRun: env.DRY_RUN === "1" || env.DRY_RUN === "true",
    venueId: env.VENUE_ID,
    agentMaxCallsPerHour: intEnv(env, "AGENT_MAX_CALLS_PER_HOUR", DEFAULT_AGENT_MAX_CALLS_PER_HOUR, 1),
    agentTimeoutMs: intEnv(env, "AGENT_TIMEOUT_MS", DEFAULT_AGENT_TIMEOUT_MS, 1_000),
  };
}
