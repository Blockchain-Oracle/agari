const TIMEOUT_RE = /timed? ?out|timeout/i;

/** A send that timed out may or may not have left — it is journaled as unknown and never auto-retried (AD-3). */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (TIMEOUT_RE.test(error.name) || TIMEOUT_RE.test(error.message));
}
