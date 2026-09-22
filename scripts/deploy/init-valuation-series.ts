#!/usr/bin/env -S pnpm exec tsx
// A valuation lane's Series (S20, D-125): one pre-IPO name's valuation ticker (OPENAIV 930, ANTHROPICV 931) on basis
// token (24/7) at one cadence, Pyth primary on the Equity.Index valuation feed with no cross-check, two 256-node Books.
// Ensure-style: creates only what is missing; drift throws.
//
// THE FEED IS PROBED FIRST, AND THE SCRIPT REFUSES WHILE THE KEY IS NOT ENTITLED. There is no --force: a Series whose
// feed the key cannot read would list nothing and still read as a lane in the app, and no dead lane is ever shown. Once
// a key with the `pyth-indices` group answers 200, this same command registers the lane, and ops' next hourly probe
// lets the roller open Windows on it with no deploy.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/deploy/init-valuation-series.ts [--cluster devnet]
//        [--symbol OPENAIV] [--cadence 3600] [--dry-run]
// Payer and admin: the deployer (GlobalConfig admin, D-026). Cost ≈ 0.011 SOL Series rent + 2 × 0.2276 SOL Book rent.

import { pythIndexFeedOf, TICKERS, VALUATION_TICKERS, type TickerSymbol } from "@agari/core/market";
import { createDeployClient, ensureBooks, ensureSeries, pythValuationSeries, seriesAddress, type PriceSources, type SeriesSpec, type StepContext } from "@agari/markets/deploy";
import { bookSpace } from "@agari/markets/ops/roller";
import { createPythEntitlementStore, describeFeed } from "../../services/ops/src/runtime/pyth-entitlement";
import { addressesFor, arg, clusterArg, endpoints, flag, readJson, redactKey, roleSecret, sol } from "./ops-cluster";

const SERIES_ACCOUNT_BYTES = 1_368;
const SIGNATURE_FEE = 5_000n;
const MARGIN = 300_000_000n;
const TOKEN_BOOKS = { count: 2, capacity: 256 } as const;
const cluster = clusterArg();
const dryRun = flag("--dry-run");
const symbol = arg("--symbol", "OPENAIV").toUpperCase() as TickerSymbol;
const cadenceSec = Number(arg("--cadence", "3600"));
if (!(VALUATION_TICKERS as readonly string[]).includes(symbol)) throw new Error(`${symbol} is not a valuation lane (${VALUATION_TICKERS.join(" ")})`);
if (![300, 900, 3_600].includes(cadenceSec)) throw new Error(`--cadence must be 300, 900 or 3600, got ${cadenceSec}`);
const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
const name = TICKERS[symbol].valuationOf!;
const feed = pythIndexFeedOf(symbol);
if (!feed) throw new Error(`Pyth publishes no valuation index for ${name}`);

// 1. The probe: one Hermes request for this feed alone, with the venue's key, before anything touches the chain.
const key = process.env.PYTH_API_KEY || undefined;
const store = createPythEntitlementStore({ key, log: () => undefined, feeds: [{ symbol: name, feedIdHex: feed.replace(/^0x/, "").toLowerCase() }] });
const probe = await store.probe(feed);
console.log(`init-valuation-series ${symbol}-${cadenceSec / 60}m on ${cluster}${dryRun ? " — DRY RUN" : ""}: Pyth Equity.Index.${name}/USD ${feed}`);
console.log(`  probe: ${describeFeed(probe)}${probe.lastError ? ` — ${probe.lastError}` : ""}`);
if (probe.state !== "entitled") {
  console.error(`refusing: the venue's key is not entitled to ${name}'s valuation index (${probe.state}${probe.status ? `, HTTP ${probe.status}` : ""}${probe.reason ? ` ${probe.reason}` : ""}).`);
  console.error(`  Nothing registers while the feed is denied and there is no --force: a Series on a feed the key cannot read would read as a lane and never settle.`);
  console.error(`  When a key with the pyth-indices group is set as PYTH_API_KEY, run this command again; ops' next hourly probe then lets the roller list ${symbol}-${cadenceSec / 60}m with no deploy.`);
  process.exit(1);
}

// 2. Entitled: the ordinary ensure-style registration, as the PreStocks lane's.
const spec: SeriesSpec = pythValuationSeries(symbol, sources, cadenceSec, TOKEN_BOOKS);
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const balance = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`  cluster ${label}, payer ${client.payer.address}, balance ${sol(balance)} SOL`);
const address = await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis);
const chain = await client.agariEvents.accounts.series.fetchMaybe(address);
const recorded = file.venue.series?.[spec.key]?.books ?? [];
const free = chain.exists ? chain.data.freeBooks.slice(0, chain.data.freeBookCount) : [];
const known = new Set([...recorded, ...free].map(String)).size;
const books = Math.max(0, TOKEN_BOOKS.count - known);
const seriesRent = chain.exists ? 0n : await client.getMinimumBalance(SERIES_ACCOUNT_BYTES);
const bookRent = BigInt(books) * (await client.getMinimumBalance(bookSpace(TOKEN_BOOKS.capacity)));
const total = seriesRent + bookRent + (chain.exists ? 0n : SIGNATURE_FEE) + BigInt(books) * 2n * SIGNATURE_FEE;
console.log(`  ${spec.key}: ${chain.exists ? "series exists" : "series + 1 version"}, ${books} book(s) to create → ${sol(total)} SOL; ticker ${spec.ticker}, basis ${spec.basis}, feed ${feed}`);
if (dryRun) process.exit(0);
if (balance < total + MARGIN) {
  console.error(`refusing: the payer needs ${sol(total + MARGIN)} SOL (total + 0.3 margin) and holds ${sol(balance)}`);
  process.exit(1);
}
const ctx: StepContext = {
  client,
  record: file.venue,
  save: (next) => {
    Object.assign(file.venue, next);
    save();
  },
  log: ({ step, signature, note }) => console.log(`  ${step.padEnd(16)} ${note}${signature ? ` https://explorer.solana.com/tx/${signature}?cluster=${cluster}` : ""}`),
};
try {
  const series = await ensureSeries(ctx, spec);
  await ensureBooks(ctx, spec, series);
} catch (error) {
  console.error(redactKey(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
const after = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`done: spent ${sol(balance - after)} SOL (planned ${sol(total)}), balance ${sol(after)} SOL → ${path}`);
