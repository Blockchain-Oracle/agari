/**
 * Dev runner: price-relay alone (relay, archive, leftovers, spot) plus the ops HTTP server.
 *   pnpm --filter @agari/ops exec tsx --env-file-if-exists=../../.env.local src/dev/price-relay.ts [--open TSLA-5m,NVDA-5m] [--open-at next|current] [--sync-clock]
 * Localnet only (SOLANA_CLUSTER=localnet, SURFPOOL_PORT): `--open` has the roller open those Series' Windows at the next
 * (or current) 5-minute boundary after recycling their Books; `--sync-clock` pulls Surfpool's clock level with the wall
 * clock every 2 s (it trails by a few seconds, D-027). Neither ever runs against devnet.
 */
import { readFileSync } from "node:fs";
import { createDeployClient, keypairSigner, openWindow, recycleBooks, type VenueRecord } from "@agari/markets/deploy";
import { chainNowSec, createOpsClient } from "@agari/markets/ops";
import { startPriceRelay } from "../actors/price-relay";
import { createSessionService } from "../calendar/session-service";
import { startOpsHttp } from "../http/server";
import { errorText, readOpsEnv, redact } from "../runtime/env";
import { roleSecret } from "../runtime/keys";

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const env = readOpsEnv();
const log = (actor: string) => (why: string) => console.log(JSON.stringify({ tsMs: Date.now(), actor, why: redact(why) }));
const wallSec = () => Math.floor(Date.now() / 1000);
const ADDRESSES = new URL("../../../../scripts/deploy/addresses.devnet.json", import.meta.url);

async function openWindows(keys: string[], at: string) {
  const roller = roleSecret("roller");
  if (!roller) throw new Error("no roller key");
  const client = await createDeployClient({ rpcUrl: env.rpcUrl, rpcSubscriptionsUrl: env.rpcSubscriptionsUrl, payerSecret: roller });
  const ctx = { client, log: (e: { step: string; signature: string | null; note: string }) => log("setup")(`${e.step}: ${e.note}${e.signature ? ` · ${e.signature}` : ""}`) };
  const venue = (JSON.parse(readFileSync(ADDRESSES, "utf8")) as { venue: VenueRecord }).venue;
  const config = await client.agariEvents.accounts.globalConfig.fetch(venue.config as never);
  // Kit refuses two signer instances for one address: the roller signs as the client payer it already is.
  const signer = client.payer as Awaited<ReturnType<typeof keypairSigner>>;
  for (const key of keys) {
    const record = venue.series?.[key];
    if (!record) throw new Error(`addresses.devnet.json has no Series ${key}`);
    await recycleBooks(ctx, record.address as never, record.books as never);
    const tradingStartSec = at === "current" ? Math.floor(wallSec() / 300) * 300 : Math.ceil((wallSec() + 15) / 300) * 300;
    const w = await openWindow(ctx, { roller: signer, series: record.address as never, mint: config.data.collateralMint, tradingStartSec });
    log("setup")(`opened ${key} #${w.index} ${new Date(tradingStartSec * 1000).toISOString()} → ${w.market}`);
  }
}

async function syncClock() {
  const client = await createOpsClient({ rpcUrl: env.rpcUrl, rpcSubscriptionsUrl: env.rpcSubscriptionsUrl, payerSecret: roleSecret("price-relay") ?? roleSecret("roller")! });
  setInterval(async () => {
    try {
      if ((await chainNowSec(client)) >= wallSec()) return;
      await fetch(env.rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "surfnet_timeTravel", params: [{ absoluteTimestamp: wallSec() * 1000 }] }),
      });
    } catch (error) {
      log("setup")(`clock sync failed: ${errorText(error)}`);
    }
  }, 2_000);
}

const localOnly = (flag: string) => {
  if (env.cluster !== "localnet") throw new Error(`${flag} is localnet-only (set SOLANA_CLUSTER=localnet)`);
};
if (process.argv.includes("--sync-clock")) {
  localOnly("--sync-clock");
  await syncClock();
}
const open = arg("--open");
if (open) {
  localOnly("--open");
  await openWindows(open.split(","), arg("--open-at") ?? "next");
}

const sessions = createSessionService();
log("calendar")(await sessions.refresh());
const relay = await startPriceRelay({ env, log: log("price-relay"), sessions, spot: null });
const http = await startOpsHttp({ port: env.httpPort, spot: relay.spot, env, log: log("http") });
process.on("SIGINT", () => {
  relay.stop();
  void http.close().then(() => process.exit(0));
});
