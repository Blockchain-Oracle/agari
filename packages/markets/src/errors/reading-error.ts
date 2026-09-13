import type { Diagnosis } from "@agari/core/types";

/** Thrown when a composed read unwraps an inner error arm; `diagnose()` passes the diagnosis through untouched. */
export class ReadingError extends Error {
  constructor(readonly diagnosis: Diagnosis) {
    super(diagnosis.technical);
    this.name = "ReadingError";
  }
}
