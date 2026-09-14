import type { Diagnosis, Quote } from "@agari/core/types";

/** A pre-send step refused the write; the lane turns it into a `refused` outcome with this diagnosis. */
export class OrderRefusedError extends Error {
  constructor(readonly diagnosis: Diagnosis) {
    super(diagnosis.technical);
    this.name = "OrderRefusedError";
  }
}

/** The fresh quote breached the confirmed cap; the lane surfaces the new quote instead of sending (FR-9). */
export class RequoteError extends Error {
  constructor(readonly quote: Quote) {
    super("fresh quote exceeds the confirmed max cost");
    this.name = "RequoteError";
  }
}

/** What the chain said about a transaction that did not succeed: in simulation, preflight, or once landed. */
export interface ChainFailure {
  /** The agari-events custom error code, when the failing instruction is ours and says one. */
  engineCode: number | null;
  /** The raw `TransactionError` as the RPC returned it. */
  err: unknown;
  logs: readonly string[];
}

/** Simulation (or the first send's preflight) refused the transaction: nothing was broadcast, no fee was paid. */
export class SimulationFailedError extends Error {
  constructor(
    readonly failure: ChainFailure,
    readonly stage: "simulation" | "preflight",
  ) {
    super(`${stage} failed: ${describeChainFailure(failure)}`);
    this.name = "SimulationFailedError";
  }
}

const jsonSafe = (_key: string, value: unknown) => (typeof value === "bigint" ? value.toString() : value);

export function describeChainFailure(failure: ChainFailure): string {
  const tail = failure.logs.filter((line) => /Program log|failed|error/i.test(line)).slice(-4);
  const head = failure.engineCode === null ? JSON.stringify(failure.err, jsonSafe) : `agari-events ${failure.engineCode}`;
  return [head, ...tail].join(" | ");
}
