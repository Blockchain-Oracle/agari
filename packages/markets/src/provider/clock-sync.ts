/**
 * The chain clock (first-call.md §2.2): one Clock sysvar read (`slot` u64 @0, `unix_timestamp` i64 @32). Timestamps are
 * whole seconds, so half the round trip is the best midpoint there is, as Masayume did with block times.
 */
import type { Reading } from "@agari/core/schemas";
import type { ClockSync } from "@agari/core/types";
import { address } from "@solana/kit";
import { solana } from "../runtime/solana";
import { applyClockSync } from "./clock";
import { withReading } from "./reading";

const CLOCK_SYSVAR = address("SysvarC1ock11111111111111111111111111111111");

/** Sent on its own (not batched), so the round trip it measures is its own. */
export async function syncClock(): Promise<Reading<ClockSync>> {
  return withReading("clock", async () => {
    const startedMs = Date.now();
    const { value } = await solana().rpc.getAccountInfo(CLOCK_SYSVAR, { encoding: "base64", commitment: "confirmed" }).send();
    const rttMs = Date.now() - startedMs;
    if (!value) throw new Error("Clock sysvar not found");
    const bytes = Uint8Array.from(atob(value.data[0]), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const chainMs = Number(view.getBigInt64(32, true)) * 1000 + rttMs / 2;
    const sync: ClockSync = { offsetMs: Math.round(chainMs - Date.now()), rttMs, slot: Number(view.getBigUint64(0, true)) };
    applyClockSync(sync);
    return sync;
  });
}

/**
 * Where a send's recovery search starts: the slot before an actor sends, so a lost reply is found by its program
 * events rather than resent (AD-3). Solana has no account nonce; the signature and slot are it.
 */
export async function readRecoveryCursor(): Promise<Reading<{ fromSlot: bigint }>> {
  return withReading("recovery-cursor", async () => ({ fromSlot: await solana().rpc.getSlot({ commitment: "confirmed" }).send() }));
}
