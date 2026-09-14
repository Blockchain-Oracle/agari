/**
 * window-roller (plan §4, venue-ops.md §5): lists Regular Windows back-to-back per the agreed session calendar on the
 * highest covering policy version, recycles Books and grows Ledgers. One writer: the `roller` key. Dry-run by default.
 */
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createOpsClient } from "@agari/markets/ops";
import { readVenueConfig } from "@agari/markets/ops/roller";
import { runActor } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { roleSecret } from "../../runtime/keys";
import { rollerPass, type RollerSettings, type RollerState } from "./execute";
import { DEFAULT_LEAD_SEC, DEFAULT_MIN_TRADABLE_SEC, type CorporateSkip } from "./plan";

const CORPORATE_ACTIONS = new URL("../../../config/corporate-actions.json", import.meta.url);

function readSkips(): CorporateSkip[] {
  if (!existsSync(CORPORATE_ACTIONS)) return [];
  const parsed = JSON.parse(readFileSync(CORPORATE_ACTIONS, "utf8")) as { skips?: CorporateSkip[] };
  return parsed.skips ?? [];
}

const intEnv = (raw: string | undefined, fallback: number) => (raw && Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : fallback);

export function readRollerSettings(env: NodeJS.ProcessEnv = process.env): RollerSettings {
  return {
    leadSec: intEnv(env.ROLLER_LEAD_SEC, DEFAULT_LEAD_SEC),
    minTradableSec: intEnv(env.ROLLER_MIN_TRADABLE_SEC, DEFAULT_MIN_TRADABLE_SEC),
    only: (env.ROLLER_SERIES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    skips: readSkips(),
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
  deps.log(`roller ${client.payer.address}, lead ${settings.leadSec} s, min tradable ${settings.minTradableSec} s${settings.only.length ? `, only ${settings.only.join(",")}` : ""}`);
  const { stop } = runActor({ name: "window-roller", log: deps.log, dryRun, everyMs: 5_000, pass: () => rollerPass(state, deps) });
  return { stop };
}
