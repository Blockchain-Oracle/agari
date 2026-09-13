/**
 * Ending a spike process.
 *
 * `closeRuntime()` releases the shared exchange and its watches, but the process still does not exit:
 * something inside the SDK's transport keeps a handle on the libuv loop after `close()` resolves. That
 * was measured on 2026-09-03 — `spike:arena-params` sat for fourteen minutes after printing its last
 * line, with its write long since confirmed on chain. `queue-drive.ts` already carried a private
 * `setTimeout(process.exit).unref()` for the same reason; this is that trick in one place, so every
 * spike ends and none of them re-invents it.
 *
 * The grace period matters: `process.exit` truncates pending stdout writes on a pipe, so the exit is
 * scheduled rather than immediate, and `unref` means a runtime that *does* release cleanly exits on its
 * own before the timer ever fires.
 */
export function finish(code = 0, graceMs = 750): void {
  process.exitCode = code;
  setTimeout(() => process.exit(code), graceMs).unref();
}
