import type { Reading } from "@masayume/core/schemas";
import { formatBaseUnits, formatUtc, secToMs } from "@masayume/core/units";
import { getDb, isDbConfigured } from "@masayume/db";
import { marketsProvider, resolveVenueId, syncClock, type MarketsEnv } from "@masayume/markets";
import { missingCredentialHint, resolveModel } from "@/features/sensei/model.server";
import { STATUS } from "./copy";
import { createDiagnosticRunner, DiagnosticFailure } from "./diagnostic-runner";
import type { StatusPipeline } from "./protocol";

/**
 * The probes behind `/api/status` — server only.
 *
 * Each one is a real read made when the page asks, bounded by its own timeout so one
 * dead dependency cannot hang the others, and each reports what it actually saw.
 * The port's reads keep a last-good value and flip `stale` when a refresh fails;
 * on a status page that is exactly the wrong thing to show as green, so a stale
 * reading counts as a failed probe here and says which reading it is holding.
 */
const PRICE_ASSETS_CAP = 4;
// Indexer stages share 10s; dependent price checks get another 10s. RPC/store
// run alongside them, keeping the route below its 30s platform allowance.
const diagnose = createDiagnosticRunner(10_000);

function fresh<T>(reading: Reading<T>): T {
  if (!reading.ok) throw new Error(reading.error.technical || reading.error.kind);
  if (reading.stale) throw new Error(STATUS.detail.stale(formatUtc(reading.asOfMs)));
  return reading.value;
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 200);

function down(id: string, label: string, detail: string, optional = false, configured = true, latencyMs: number | null = null): StatusPipeline {
  return { id, label, ok: false, lagSec: null, latencyMs, detail, optional, configured };
}

const elapsed = (error: unknown) => error instanceof DiagnosticFailure ? error.elapsedMs : null;

export async function probeRpc(): Promise<{ pipeline: StatusPipeline; blockNumber: number | null }> {
  const label = STATUS.pipelines.rpc;
  try {
    const clock = await diagnose("rpc", ({ step }) => step("RPC chain head", async () => fresh(await syncClock())));
    const { blockNumber, rttMs, offsetMs } = clock.value;
    // Block timestamps are whole seconds, so a head a second "behind" is normal; one minutes
    // behind is a chain that stopped, not a slow socket.
    const lagSec = Math.max(0, Math.round(-offsetMs / 1000));
    const offsetText = `${offsetMs >= 0 ? "+" : "−"}${(Math.abs(offsetMs) / 1000).toFixed(1)}`;
    return {
      pipeline: { id: "rpc", label, ok: true, lagSec, latencyMs: rttMs, detail: STATUS.detail.rpc(blockNumber.toLocaleString("en-US"), offsetText), optional: false, configured: true },
      blockNumber,
    };
  } catch (error) {
    return { pipeline: down("rpc", label, message(error), false, true, elapsed(error)), blockNumber: null };
  }
}

export async function probeIndexer(env: MarketsEnv): Promise<{ pipeline: StatusPipeline; assets: string[] }> {
  const label = STATUS.pipelines.indexer;
  try {
    const result = await diagnose(`indexer:${env.indexerUrl}:${env.venueId}`, async ({ step }) => {
      const venue = await step("Venue discovery", async () => fresh(await resolveVenueId(env.venueId)));
      if (venue.venueId === null) throw new Error(STATUS.detail.noVenue);
      const venueId = venue.venueId;
      const lanes = await step("Live Windows and opening prices", async () => fresh(await marketsProvider.listLiveLanes(venueId)));
      return { venue, lanes };
    });
    const { venue, lanes } = result.value;
    const windows = lanes.lanes.reduce((n, lane) => n + lane.markets.length, 0);
    const assets = [...new Set(lanes.lanes.flatMap((lane) => lane.markets.map((market) => market.asset)))].sort().slice(0, PRICE_ASSETS_CAP);
    const source = STATUS.detail.venueSource[venue.source];
    return {
      pipeline: { id: "indexer", label, ok: true, lagSec: null, latencyMs: result.elapsedMs, detail: STATUS.detail.indexer(lanes.lanes.length, windows, source), optional: false, configured: true },
      assets,
    };
  } catch (error) {
    return { pipeline: down("indexer", label, message(error), false, true, elapsed(error)), assets: [] };
  }
}

/** The one real "time lag" here: how old the feed's latest print is against the wall clock. */
export async function probePrice(asset: string, nowMs: number): Promise<StatusPipeline> {
  const id = `price:${asset}`;
  const label = STATUS.pipelines.price(asset);
  try {
    const result = await diagnose(id, ({ step }) => step(`${asset} latest price`, async () => fresh(await marketsProvider.getAssetPrice(asset))));
    const price = result.value;
    if (price === null) return down(id, label, STATUS.detail.noPrint, false, true, result.elapsedMs);
    const printedMs = secToMs(price.blockTimestampSec);
    const lagSec = Math.max(0, Math.round((nowMs - printedMs) / 1000));
    const priceText = `$${formatBaseUnits(price.priceRaw, price.decimals)}`;
    return { id, label, ok: true, lagSec, latencyMs: result.elapsedMs, detail: STATUS.detail.price(priceText, formatUtc(printedMs)), optional: false, configured: true };
  } catch (error) {
    return down(id, label, message(error), false, true, elapsed(error));
  }
}

export async function probeStore(): Promise<StatusPipeline> {
  const label = STATUS.pipelines.store;
  if (!isDbConfigured()) return down("store", label, STATUS.detail.storeOff, true, false);
  try {
    const db = getDb();
    if (!db) return down("store", label, STATUS.detail.storeOff, true, false);
    const result = await diagnose("store", ({ step }) => step("Database read", async () => db`select 1`));
    return { id: "store", label, ok: true, lagSec: null, latencyMs: result.elapsedMs, detail: STATUS.detail.storeOk, optional: true, configured: true };
  } catch (error) {
    return down("store", label, STATUS.detail.storeDown(message(error)), true, true, elapsed(error));
  }
}

/** Which model would answer — never a key, only the route it would take. */
export function probeSensei(): StatusPipeline {
  const label = STATUS.pipelines.sensei;
  try {
    const model = resolveModel();
    if (!model) return down("sensei", label, STATUS.detail.senseiOff(missingCredentialHint()), true, false);
    return { id: "sensei", label, ok: true, lagSec: null, latencyMs: null, detail: STATUS.detail.senseiOk(model.providerName, model.modelId, model.via), optional: true, configured: true };
  } catch (error) {
    return down("sensei", label, message(error), true, true);
  }
}
