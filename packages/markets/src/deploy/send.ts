/** Sending, drift errors and the addresses record shared by the deploy steps. */
import { getAgariEventsErrorMessage, type AgariEventsError } from "@agari/clients/agari-events";
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
    const result = await ctx.client.sendTransaction(instructions);
    const signature = String(result.context.signature);
    ctx.log({ step, signature, note });
    return signature;
  } catch (error) {
    throw new Error(`${step} failed: ${describeSendError(error)}`, { cause: error });
  }
}

const ENGINE_CODES = { min: 6000, max: 6399 };

/** The first custom program error code and any logs found along a Kit error's cause chain. */
export function describeSendError(error: unknown): string {
  const parts: string[] = [];
  let logs: string[] = [];
  for (let e: unknown = error, depth = 0; e && depth < 8; e = (e as { cause?: unknown }).cause, depth++) {
    const context = (e as { context?: Record<string, unknown> }).context ?? {};
    if (parts.length === 0 && e instanceof Error) parts.push(e.message);
    const code = context.code;
    if (typeof code === "number" && code >= ENGINE_CODES.min && code <= ENGINE_CODES.max) {
      parts.push(`agari-events ${code}: ${getAgariEventsErrorMessage(code as AgariEventsError)}`);
    }
    if (Array.isArray(context.logs) && logs.length === 0) logs = context.logs.map(String);
  }
  const tail = logs.filter((l) => /Program log|failed|error/i.test(l)).slice(-6);
  return [...parts, ...tail.map((l) => `  log: ${l}`)].join("\n");
}
