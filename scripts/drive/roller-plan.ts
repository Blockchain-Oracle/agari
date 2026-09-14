#!/usr/bin/env -S pnpm exec tsx
// S3 roller plan printer (venue-ops.md §5.9): what window-roller would do for every launch ticker × Regular cadence at
// a given clock. Reads only (Series from chain, calendar from Alpaca ∩ Pyth). Unregistered Series are planned from
// price-sources.json and marked "not registered".
// Run: pnpm drive:roller-plan [--at 2026-09-28T14:00:00Z] [--cluster devnet|localnet]

import { TICKER_SYMBOLS, TICKERS } from "@agari/core/market";
import { policyVersions, type PriceSources } from "@agari/markets/deploy";
import { createOpsClient, listSeries } from "@agari/markets/ops";
import { createSessionService } from "../../services/ops/src/calendar/session-service";
import { DEFAULT_LEAD_SEC, DEFAULT_MIN_TRADABLE_SEC, planSeries, spanOf, type PlanSeries } from "../../services/ops/src/actors/window-roller/plan";
import { versionWindow } from "../../services/ops/src/actors/window-roller/versions";
import { arg, clusterArg, endpoints, readJson, redactKey, roleSecret } from "../deploy/ops-cluster";

process.on("uncaughtException", (e) => {
  console.error(redactKey(e instanceof Error ? (e.stack ?? e.message) : String(e)));
  process.exit(1);
});

const atIso = arg("--at", new Date().toISOString());
const atSec = Math.floor(Date.parse(atIso) / 1000);
if (!Number.isFinite(atSec)) throw new Error(`--at must be an ISO time, got ${atIso}`);
const cluster = clusterArg();

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createOpsClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("roller") });
const sessions = createSessionService({ nowSec: () => atSec });
console.log(await sessions.refresh(true));
const status = sessions.status(atSec);
console.log(`roller plan at ${new Date(atSec * 1000).toISOString()} on ${cluster} (${label}): session ${status?.state ?? "unknown"}${status?.session ? ` ${spanOf({ tradingStartSec: status.session.openSec, expirySec: status.session.closeSec })}` : ""}`);

const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
const onChain = new Map((await listSeries(client)).filter((s) => s.symbol && s.data.basis === 0).map((s) => [`${s.symbol}-${s.data.cadenceSec / 60}m`, s]));
const clock = { calendar: sessions.calendar(), nowSec: atSec, leadSec: DEFAULT_LEAD_SEC, minTradableSec: DEFAULT_MIN_TRADABLE_SEC, skips: [] };

for (const symbol of TICKER_SYMBOLS.filter((s) => TICKERS[s].launch)) {
  for (const cadenceSec of [300, 900, 3_600]) {
    const key = `${symbol}-${cadenceSec / 60}m`;
    const chain = onChain.get(key);
    const series: PlanSeries = chain
      ? {
          key, symbol, cadenceSec, nextIndex: chain.data.nextIndex, lastExpirySec: Number(chain.data.lastExpiry),
          versions: chain.data.policyVersions.slice(0, chain.data.versionCount).map(versionWindow), freeBooks: chain.data.freeBooks.slice(0, chain.data.freeBookCount),
        }
      : { key, symbol, cadenceSec, nextIndex: 0n, lastExpirySec: 0, versions: policyVersions(symbol, sources).map(versionWindow), freeBooks: ["(unregistered)"] };
    const plan = planSeries(series, clock);
    const state = plan.kind === "open" ? plan.state.replace("opening", chain ? "would open" : "would list") : plan.state;
    const window = "window" in plan ? ` (${spanOf(plan.window)})` : "";
    console.log(`  ${key.padEnd(10)} ${(chain ? "registered" : "not registered").padEnd(15)} ${state}${plan.kind === "open" ? "" : window}`);
  }
}
process.exit(0);
