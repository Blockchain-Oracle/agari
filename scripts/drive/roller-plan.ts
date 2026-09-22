#!/usr/bin/env -S pnpm exec tsx
// S3 roller plan printer (venue-ops.md §5.9): what window-roller would do for every launch ticker × Regular cadence,
// each launch ticker's Gap and each token-lane ticker × cadence (S6, session-lanes.md §6) at a given clock. Reads only
// (Series from chain, calendar from Alpaca ∩ Pyth). Unregistered Series are planned from price-sources.json and marked
// "not registered"; a lane whose versions aren't built yet says so.
// Run: pnpm drive:roller-plan [--at 2026-09-28T14:00:00Z] [--cluster devnet|localnet]

import { laneKey, TICKER_SYMBOLS, TICKERS, TOKEN_LANE_TICKERS, type TickerSymbol } from "@agari/core/market";
import { GAP_CADENCE_SEC, type LaneBasis } from "@agari/core/types";
import { LAUNCH_GRID, policyVersions, type PriceSources } from "@agari/markets/deploy";
import { createOpsClient, listSeries, seriesBasis, seriesLaneKey } from "@agari/markets/ops";
import { createSessionService } from "../../services/ops/src/calendar/session-service";
import {
  DEFAULT_GAP_LEAD_SEC, DEFAULT_LEAD_SEC, DEFAULT_MIN_TRADABLE_SEC, DEFAULT_PRELIST, DEFAULT_PRELIST_CADENCES_SEC, spanOf, type PlanSeries,
} from "../../services/ops/src/actors/window-roller/plan";
import { planByBasis } from "../../services/ops/src/actors/window-roller/plan-basis";
import { gapSpanOf } from "../../services/ops/src/actors/window-roller/plan-gap";
import { createSessionEvents } from "../../services/ops/src/runtime/session-events";
import { versionWindow } from "../../services/ops/src/actors/window-roller/versions";
import { isPythIndexFeed } from "../../services/ops/src/runtime/pyth-entitlement";
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
const onChain = new Map((await listSeries(client)).filter((s) => s.symbol && seriesBasis(s)).map((s) => [seriesLaneKey(s), s]));
const events = createSessionEvents();
// No halt-watch and no entitlement probe run here: the printed plan assumes no asset is halted at `--at`, and a
// valuation index (S20) counts as not entitled, so a valuation lane prints as paused rather than as a Window it might not settle.
const clock = {
  calendar: sessions.calendar(), nowSec: atSec, leadSec: DEFAULT_LEAD_SEC, gapLeadSec: DEFAULT_GAP_LEAD_SEC,
  minTradableSec: DEFAULT_MIN_TRADABLE_SEC, skips: events.skips(), multipliers: events.multipliers(), halts: {},
  prelist: DEFAULT_PRELIST, prelistCadencesSec: DEFAULT_PRELIST_CADENCES_SEC, pythUsable: (hex: string) => !isPythIndexFeed(hex),
};

const launch = TICKER_SYMBOLS.filter((s) => TICKERS[s].launch);
const lanes: Array<[TickerSymbol, LaneBasis, number]> = [
  ...launch.flatMap((symbol) => [300, 900, 3_600].map((c): [TickerSymbol, LaneBasis, number] => [symbol, "regular", c])),
  ...launch.map((symbol): [TickerSymbol, LaneBasis, number] => [symbol, "gap", GAP_CADENCE_SEC]),
  ...TOKEN_LANE_TICKERS.flatMap((symbol) => [300, 900, 3_600].map((c): [TickerSymbol, LaneBasis, number] => [symbol, "token", c])),
];

for (const [symbol, basis, cadenceSec] of lanes) {
  const key = laneKey(symbol, basis, cadenceSec);
  const chain = onChain.get(key);
  let series: PlanSeries;
  if (chain) {
    series = {
      key, symbol, cadenceSec, maxLeadSec: chain.data.maxLeadSec, nextIndex: chain.data.nextIndex, lastExpirySec: Number(chain.data.lastExpiry),
      versions: chain.data.policyVersions.slice(0, chain.data.versionCount).map(versionWindow), freeBooks: chain.data.freeBooks.slice(0, chain.data.freeBookCount),
    };
  } else {
    try {
      series = { key, symbol, cadenceSec, maxLeadSec: LAUNCH_GRID.maxLeadSec, nextIndex: 0n, lastExpirySec: 0, versions: policyVersions(symbol, sources, basis).map(versionWindow), freeBooks: ["(unregistered)"] };
    } catch (error) {
      console.log(`  ${key.padEnd(10)} ${"not registered".padEnd(15)} ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
  }
  const plan = planByBasis(basis, series, clock);
  const state = plan.kind === "open" ? plan.state.replace("opening", chain ? "would open" : "would list").replace("prelisting", "would prelist") : plan.state;
  const window = "window" in plan ? ` (${basis === "gap" ? gapSpanOf(plan.window) : spanOf(plan.window)})` : "";
  console.log(`  ${key.padEnd(10)} ${(chain ? "registered" : "not registered").padEnd(15)} ${state}${plan.kind === "open" ? "" : window}`);
}
process.exit(0);
