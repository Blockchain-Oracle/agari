/** Sending, drift errors and the addresses record shared by the deploy steps. */
import { AGARI_EVENTS_PROGRAM_ADDRESS, getAgariEventsErrorMessage } from "@agari/clients/agari-events";
import { AGARI_MAKER_PROGRAM_ADDRESS, getAgariMakerErrorMessage } from "@agari/clients/agari-maker";
import { AGARI_ARENA_PROGRAM_ADDRESS, getAgariArenaErrorMessage } from "@agari/clients/agari-arena";
import { AGARI_LEVERAGE_PROGRAM_ADDRESS, getAgariLeverageErrorMessage } from "@agari/clients/agari-leverage";
import { AGARI_PRIVATE_PROGRAM_ADDRESS, getAgariPrivateErrorMessage } from "@agari/clients/agari-private";
import { AGARI_PARLAY_PROGRAM_ADDRESS, getAgariParlayErrorMessage } from "@agari/clients/agari-parlay";
import { AGARI_RANGE_PROGRAM_ADDRESS, getAgariRangeErrorMessage } from "@agari/clients/agari-range";
import { AGARI_STRATEGY_PROGRAM_ADDRESS, getAgariStrategyErrorMessage } from "@agari/clients/agari-strategy";
import { AGARI_VAULT_PROGRAM_ADDRESS, getAgariVaultErrorMessage } from "@agari/clients/agari-vault";
import type { Instruction } from "@solana/kit";
import type { DeployClient } from "./client";

/** `scripts/deploy/addresses.<cluster>.json` → `venue`. Written after every confirmed step. */
export type VenueRecord = {
  admin?: string;
  config?: string;
  collateralMint?: string;
  collateralDecimals?: number;
  mintAuthority?: string;
  treasury?: string;
  series?: Record<string, SeriesRecord>;
};

export type SeriesRecord = { address: string; ticker: number; cadenceSec: number; basis: number; books: string[] };

export type StepLog = { step: string; signature: string | null; note: string };

/** What sending needs: a funded client and somewhere to report each confirmed step. */
export type SendContext = { client: DeployClient; log: (entry: StepLog) => void };

export type StepContext = SendContext & {
  record: VenueRecord;
  save: (record: VenueRecord) => void;
};

/** A chain value that differs from what the script would create. Never auto-corrected: fix the file or the chain by hand. */
export class DriftError extends Error {
  constructor(what: string, diffs: string[]) {
    super(`${what} drifted from the wanted state:\n  - ${diffs.join("\n  - ")}`);
    this.name = "DriftError";
  }
}

export function assertNoDrift(what: string, diffs: string[]) {
  if (diffs.length > 0) throw new DriftError(what, diffs);
}

export function diffField(out: string[], name: string, chain: unknown, want: unknown) {
  const norm = (v: unknown) => (v instanceof Uint8Array || Array.isArray(v) ? JSON.stringify(Array.from(v as ArrayLike<unknown>, String)) : String(v));
  if (norm(chain) !== norm(want)) out.push(`${name}: chain ${norm(chain)} ≠ want ${norm(want)}`);
}

export const hex = (bytes: ArrayLike<number>) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export async function send(ctx: SendContext, step: string, instructions: Instruction[], note: string): Promise<string> {
  try {
    const result = await ctx.client.sendTransaction(instructions, { abortSignal: AbortSignal.timeout(120_000) });
    const signature = String(result.context.signature);
    ctx.log({ step, signature, note });
    return signature;
  } catch (error) {
    throw new Error(`${step} failed: ${describeSendError(error)}`, { cause: error });
  }
}

const ENGINE_CODES = { min: 6000, max: 6399 };

/**
 * Anchor numbers every program's errors from 6000, so a code alone does not say which program refused. Each
 * Agari program is looked up in its own table, found from the `Program <id> failed` line the runtime logs.
 *
 * Without this a range refusal reads as an events one — `StaleMark` (6005) printed as "window overlaps the
 * previous window" — which sends whoever is reading the drive output to entirely the wrong place.
 */
const ERROR_TABLES: ReadonlyArray<readonly [string, string, (code: never) => string]> = [
  [AGARI_EVENTS_PROGRAM_ADDRESS, "agari-events", getAgariEventsErrorMessage as (code: never) => string],
  [AGARI_RANGE_PROGRAM_ADDRESS, "agari-range", getAgariRangeErrorMessage as (code: never) => string],
  [AGARI_PARLAY_PROGRAM_ADDRESS, "agari-parlay", getAgariParlayErrorMessage as (code: never) => string],
  [AGARI_LEVERAGE_PROGRAM_ADDRESS, "agari-leverage", getAgariLeverageErrorMessage as (code: never) => string],
  [AGARI_PRIVATE_PROGRAM_ADDRESS, "agari-private", getAgariPrivateErrorMessage as (code: never) => string],
  [AGARI_ARENA_PROGRAM_ADDRESS, "agari-arena", getAgariArenaErrorMessage as (code: never) => string],
  [AGARI_STRATEGY_PROGRAM_ADDRESS, "agari-strategy", getAgariStrategyErrorMessage as (code: never) => string],
  [AGARI_MAKER_PROGRAM_ADDRESS, "agari-maker", getAgariMakerErrorMessage as (code: never) => string],
  [AGARI_VAULT_PROGRAM_ADDRESS, "agari-vault", getAgariVaultErrorMessage as (code: never) => string],
];

/**
 * The program whose error code this is: the innermost one that failed.
 *
 * A CPI failure unwinds outwards, and the runtime logs each frame as it goes — so the *first* `Program … failed`
 * line is the program that actually refused, and the ones after it are its callers reporting the same code. Taking
 * the last gives the outermost caller, which does not own the code: a post-only refusal from the engine (6109)
 * came out as "agari-maker 6109: undefined", because agari-maker has no error 6109 at all.
 */
function failingProgram(logs: readonly string[]): (typeof ERROR_TABLES)[number] | null {
  for (const line of logs) {
    const match = /^Program ([1-9A-HJ-NP-Za-km-z]{32,44}) failed/.exec(line);
    const table = match ? ERROR_TABLES.find(([address]) => address === match[1]) : undefined;
    if (table) return table;
  }
  return null;
}

/** The first custom program error code and any logs found along a Kit error's cause chain. */
export function describeSendError(error: unknown): string {
  const parts: string[] = [];
  let logs: string[] = [];
  let code: number | null = null;
  for (let e: unknown = error, depth = 0; e && depth < 8; e = (e as { cause?: unknown }).cause, depth++) {
    const context = (e as { context?: Record<string, unknown> }).context ?? {};
    if (parts.length === 0 && e instanceof Error) parts.push(e.message);
    const found = context.code;
    if (code === null && typeof found === "number" && found >= ENGINE_CODES.min && found <= ENGINE_CODES.max) code = found;
    if (Array.isArray(context.logs) && logs.length === 0) logs = context.logs.map(String);
  }
  if (code !== null) {
    const table = failingProgram(logs);
    // A code outside the table's own range decodes to nothing, so say the number rather than print "undefined".
    const described = table ? table[2](code as never) : undefined;
    parts.push(described ? `${table![1]} ${code}: ${described}` : `custom program error ${code}${table ? ` from ${table[1]}` : ""}`);
  }
  const tail = logs.filter((l) => /Program log|failed|error/i.test(l)).slice(-6);
  return [...parts, ...tail.map((l) => `  log: ${l}`)].join("\n");
}
