#!/usr/bin/env -S pnpm exec tsx
// S6 init-token-series, ensure-style (session-lanes.md §2.3–2.4, D-055/D-056): the 24/7 token lane's Series,
// TSLAx/NVDAx/SPYx/QQQx × 5m/15m/60m (basis 2) on the Switchboard v1 version with 2 × 256-node Books each, and the
// GlobalConfig Switchboard pin (queue + min oracles, re-sending the full authority set). Creates only what is missing;
// drift throws. Stage owner only on devnet, and only after the program upgrade that adds public_record_print_switchboard.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/deploy/init-token-series.ts [--cluster devnet|localnet]
//        [--dry-run] [--symbols TSLA,NVDA,SPY,QQQ] [--cadences 300,900,3600] [--min-oracles 3] [--no-pin]
//   --dry-run prints what is missing, its exact rent, the pin change and the payer balance, and sends nothing.
// Payer and admin: the deployer (GlobalConfig admin, D-026). A real run refuses below the total + 0.5 SOL.

import { TOKEN_LANE_TICKERS, type TickerSymbol } from "@agari/core/market";
import {
  createDeployClient, ensureBooks, ensureSeries, pinSwitchboardQueue, readSwitchboardPin, seriesAddress, SWITCHBOARD_DEVNET_QUEUE_ADDRESS,
  TOKEN_CADENCES, tokenSeries, type PriceSources, type SeriesSpec, type StepContext,
} from "@agari/markets/deploy";
import { bookSpace } from "@agari/markets/ops/roller";
import { addressesFor, arg, clusterArg, endpoints, flag, readJson, redactKey, roleSecret, sol } from "./ops-cluster";

const SERIES_ACCOUNT_BYTES = 1_368;
const SIGNATURE_FEE = 5_000n;
const MARGIN = 500_000_000n;
const cluster = clusterArg();
const dryRun = flag("--dry-run");
const pin = !flag("--no-pin");
const minOracles = Number(arg("--min-oracles", "3"));
const cadences = arg("--cadences", TOKEN_CADENCES.join(",")).split(",").map(Number);
const symbols = arg("--symbols", TOKEN_LANE_TICKERS.join(",")).split(",") as TickerSymbol[];
for (const s of symbols) if (!TOKEN_LANE_TICKERS.includes(s)) throw new Error(`${s} has no token lane (${TOKEN_LANE_TICKERS.join(" ")})`);
for (const c of cadences) if (!(TOKEN_CADENCES as readonly number[]).includes(c)) throw new Error(`cadence ${c} is not a token cadence`);
if (!Number.isInteger(minOracles) || minOracles < 1 || minOracles > 8) throw new Error(`--min-oracles must be 1..8, got ${minOracles}`);

const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
const specs: SeriesSpec[] = tokenSeries(sources, symbols, cadences);

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const balance = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-token-series on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(balance)} SOL${dryRun ? " — DRY RUN" : ""}`);

type Need = { spec: SeriesSpec; series: boolean; versions: number; books: number; lamports: bigint };
const rent = new Map<number, bigint>();
const rentOf = async (bytes: number) => rent.get(bytes) ?? (rent.set(bytes, await client.getMinimumBalance(bytes)), rent.get(bytes)!);

async function needOf(spec: SeriesSpec): Promise<Need> {
  const address = await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis);
  const chain = await client.agariEvents.accounts.series.fetchMaybe(address);
  const recorded = file.venue.series?.[spec.key]?.books ?? [];
  const free = chain.exists ? chain.data.freeBooks.slice(0, chain.data.freeBookCount) : [];
  const known = new Set([...recorded, ...free].map(String)).size;
  const books = Math.max(0, spec.books!.count - known);
  const versions = chain.exists ? Math.max(0, spec.versions.length - chain.data.versionCount) : spec.versions.length;
  const seriesRent = chain.exists ? 0n : await rentOf(SERIES_ACCOUNT_BYTES);
  const bookRent = BigInt(books) * (await rentOf(bookSpace(spec.books!.capacity)));
  const fees = (chain.exists && versions === 0 ? 0n : SIGNATURE_FEE) + BigInt(books) * 2n * SIGNATURE_FEE;
  return { spec, series: !chain.exists, versions, books, lamports: seriesRent + bookRent + fees };
}

const needs: Need[] = [];
for (const spec of specs) needs.push(await needOf(spec));
for (const n of needs) {
  const what = [n.series ? `series + ${n.versions} version(s)` : n.versions ? `${n.versions} version(s)` : "", n.books ? `${n.books} × ${n.spec.books!.capacity}-node book` : ""].filter(Boolean).join(", ");
  console.log(`  ${n.spec.key.padEnd(10)} ${what ? `missing: ${what}`.padEnd(52) : "complete".padEnd(52)} ${n.lamports ? `${sol(n.lamports)} SOL` : ""}`);
}
const current = await readSwitchboardPin(client);
const pinChange = pin && (current.queue !== SWITCHBOARD_DEVNET_QUEUE_ADDRESS || current.minOracles !== minOracles);
console.log(`switchboard pin: queue ${current.queue ?? "unset (zero placeholder)"}, min ${current.minOracles}${pinChange ? ` → ${SWITCHBOARD_DEVNET_QUEUE_ADDRESS}, min ${minOracles} (admin_set_authorities, full set re-sent)` : pin ? " (as wanted)" : " (--no-pin)"}`);
const total = needs.reduce((sum, n) => sum + n.lamports, 0n) + (pinChange ? SIGNATURE_FEE : 0n);
const [seriesCount, bookCount] = [needs.filter((n) => n.series).length, needs.reduce((s, n) => s + n.books, 0)];
console.log(`total: ${seriesCount} series, ${bookCount} books, ${sol(total)} SOL (rent ${[...rent].map(([b, l]) => `${b} B = ${sol(l)}`).join(", ")}); balance ${sol(balance)} SOL`);

if (dryRun) process.exit(0);
if (balance < total + MARGIN) {
  console.error(`refusing: the payer needs ${sol(total + MARGIN)} SOL (total + 0.5 margin) and holds ${sol(balance)}`);
  process.exit(1);
}
const ctx: StepContext = {
  client,
  record: file.venue,
  save: (next) => {
    Object.assign(file.venue, next);
    save();
  },
  log: ({ step, signature, note }) => console.log(`  ${step.padEnd(16)} ${note}${signature ? ` ${cluster === "devnet" ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : signature}` : ""}`),
};
try {
  if (pin) await pinSwitchboardQueue(ctx, SWITCHBOARD_DEVNET_QUEUE_ADDRESS, minOracles);
  for (const n of needs) {
    const series = await ensureSeries(ctx, n.spec);
    await ensureBooks(ctx, n.spec, series);
  }
} catch (error) {
  console.error(redactKey(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
const after = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`done: spent ${sol(balance - after)} SOL (planned ${sol(total)}), balance ${sol(after)} SOL → ${path}`);
