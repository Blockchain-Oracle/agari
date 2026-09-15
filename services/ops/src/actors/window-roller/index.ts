/**
 * window-roller (plan §4, venue-ops.md §5): lists Regular Windows back-to-back per the agreed session calendar on the
 * highest covering policy version, recycles Books and grows Ledgers; Gap and token Series plan by basis (S6). One
 * writer: the `roller` key. Dry-run by default. Corporate skips come from `deps.events` (re-read when the file changes).
 */
import { generateKeyPairSync } from "node:crypto";
import { createOpsClient } from "@agari/markets/ops";
import { readVenueConfig } from "@agari/markets/ops/roller";
import { runActor } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { roleSecret } from "../../runtime/keys";
import { rollerPass, type RollerSettings, type RollerState } from "./execute";
import { DEFAULT_GAP_LEAD_SEC, DEFAULT_LEAD_SEC, DEFAULT_MIN_TRADABLE_SEC, DEFAULT_PRELIST, DEFAULT_PRELIST_CADENCES_SEC } from "./plan";

const intEnv = (raw: string | undefined, fallback: number) => (raw && Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : fallback);
const boolEnv = (raw: string | undefined, fallback: boolean) => (raw === undefined || raw === "" ? fallback : !["0", "false", "off", "no"].includes(raw.toLowerCase()));

/** `ROLLER_PRELIST_CADENCES=300,900`; unknown or empty falls back to every Regular cadence. */
function cadences(raw: string | undefined): number[] {
  const picked = (raw ?? "").split(",").map(Number).filter((n) => DEFAULT_PRELIST_CADENCES_SEC.includes(n));
  return picked.length ? picked : DEFAULT_PRELIST_CADENCES_SEC;
}

export function readRollerSettings(env: NodeJS.ProcessEnv = process.env): RollerSettings {
  return {
    leadSec: intEnv(env.ROLLER_LEAD_SEC, DEFAULT_LEAD_SEC),
    gapLeadSec: intEnv(env.ROLLER_GAP_LEAD_SEC, DEFAULT_GAP_LEAD_SEC),
    minTradableSec: intEnv(env.ROLLER_MIN_TRADABLE_SEC, DEFAULT_MIN_TRADABLE_SEC),
    prelist: boolEnv(env.ROLLER_PRELIST, DEFAULT_PRELIST),
    prelistCadencesSec: cadences(env.ROLLER_PRELIST_CADENCES),
    only: (env.ROLLER_SERIES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

/** A throwaway identity for scan-and-report: it never signs, because the actor is forced dry. */
function readOnlyIdentity(): Uint8Array {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const d = Buffer.from(privateKey.export({ format: "jwk" }).d!, "base64url");
  const x = Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url");
  return Uint8Array.from([...d, ...x]);
}

export async function startWindowRoller(deps: VenueDeps): Promise<{ stop: () => void }> {
  const secret = roleSecret("roller");
  const client = await createOpsClient({ rpcUrl: deps.env.rpcUrl, rpcSubscriptionsUrl: deps.env.rpcSubscriptionsUrl, payerSecret: secret ?? readOnlyIdentity() });
  const config = await readVenueConfig(client);
  let dryRun = deps.env.dryRun;
  if (!secret) {
    deps.log("ROLLER_PRIVATE_KEY / roller.json missing: scanning and reporting only");
    dryRun = true;
  } else if (!config.rollers.includes(client.payer.address)) {
    deps.log(`roller key ${client.payer.address} is not in GlobalConfig.rollers: scanning and reporting only`);
    dryRun = true;
  }
  const settings = readRollerSettings();
  const state: RollerState = {
    client, config, settings, dryRun, series: [], seriesListedMs: 0, lowIndex: new Map(),
    counters: { opened: 0, swept: 0, released: 0, grown: 0, failed: 0 },
  };
  const prelist = settings.prelist ? `prelist ${settings.prelistCadencesSec.map((c) => `${c / 60}m`).join("/")}` : "prelist off";
  deps.log(`roller ${client.payer.address}, lead ${settings.leadSec} s, gap lead ${settings.gapLeadSec} s, min tradable ${settings.minTradableSec} s, ${prelist}${settings.only.length ? `, only ${settings.only.join(",")}` : ""}`);
  const { stop } = runActor({ name: "window-roller", log: deps.log, dryRun, everyMs: 5_000, pass: () => rollerPass(state, deps) });
  return { stop };
}
