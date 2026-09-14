/**
 * Dev runner: the window-roller alone. `SOLANA_CLUSTER=localnet SURFPOOL_PORT=8910 DRY_RUN=0 pnpm exec tsx
 * --env-file-if-exists=../../.env.local src/dev/window-roller.ts` (from services/ops). On localnet it pulls the
 * Surfpool clock level with the wall clock every few seconds (the fork trails it; D-027), which devnet never needs.
 */
import { createSessionService } from "../calendar/session-service";
import { startWindowRoller } from "../actors/window-roller";
import { readOpsEnv, redact } from "../runtime/env";
import { heartbeats } from "../runtime/heartbeat";

const env = readOpsEnv();
const log = (why: string) => console.log(JSON.stringify({ tsMs: Date.now(), actor: "window-roller", why: redact(why) }));

async function syncSurfpoolClock(): Promise<void> {
  const call = async (method: string, params: unknown[] = []) => {
    const res = await fetch(env.rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    return (await res.json()) as { result?: unknown; error?: { message: string } };
  };
  const clock = (await call("getAccountInfo", ["SysvarC1ock11111111111111111111111111111111", { encoding: "base64" }])).result as { value: { data: [string] } } | undefined;
  const chainSec = clock ? Number(Buffer.from(clock.value.data[0], "base64").readBigInt64LE(32)) : null;
  const wallSec = Math.floor(Date.now() / 1000);
  if (chainSec !== null && chainSec < wallSec - 1) await call("surfnet_timeTravel", [{ absoluteTimestamp: wallSec * 1000 }]);
}

if (env.cluster === "localnet") {
  setInterval(() => void syncSurfpoolClock().catch((e) => log(`clock sync failed: ${String(e)}`)), 3_000);
  await syncSurfpoolClock();
}
await startWindowRoller({ env, log, sessions: createSessionService(), spot: null });
// What `/health` will serve: the lane states and counters, once a minute.
setInterval(() => console.log(JSON.stringify({ tsMs: Date.now(), heartbeat: heartbeats().find((b) => b.actor === "window-roller") })), 60_000);
