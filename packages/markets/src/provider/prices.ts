/**
 * Spot and recorded prints (first-call.md §2.2). Spot is display only: the shared stream's latest tick while it is
 * live, else one `/prices/latest` snapshot shared by every symbol asking in the same second. Print history is what
 * the chain recorded, from the index.
 */
import type { TickerSymbol } from "@agari/core/market";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type AssetPrice, type PricePoint } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";
import { peekClient } from "../runtime/read-runtime";
import { liveSpot } from "../runtime/spot-stream";
import { indexRows, NO_STORE, sec, type ArchiveRow, type PrintHistoryRow } from "./index-api";
import { withReading } from "./reading";

/** Spot and prints are `PRINT_EXPO` (× 10⁻⁸) integers. */
const SPOT_DECIMALS = 8;
const LATEST_MEMO_MS = 1_000;

type LatestBody = Record<string, { priceE8: string; publishTimeSec: number; source: string }>;

let latest: { atMs: number; body: Promise<LatestBody> } | null = null;

function latestSnapshot(base: string): Promise<LatestBody> {
  const now = Date.now();
  if (latest && now - latest.atMs < LATEST_MEMO_MS) return latest.body;
  const body = fetch(`${base.replace(/\/$/, "")}/prices/latest`, { ...NO_STORE, headers: { accept: "application/json" } }).then(async (response) => {
    if (!response.ok) throw new ReadingError(diagnosis("rpc-down", `price feed ${response.status}`));
    return (await response.json()) as LatestBody;
  });
  latest = { atMs: now, body };
  body.catch(() => {
    if (latest?.body === body) latest = null;
  });
  return body;
}

const toAssetPrice = (asset: TickerSymbol, priceE8: bigint, publishTimeSec: number): AssetPrice => ({
  asset,
  priceRaw: priceE8,
  emaRaw: priceE8,
  decimals: SPOT_DECIMALS,
  publishTimeSec,
});

export async function getAssetPrice(asset: TickerSymbol): Promise<Reading<AssetPrice | null>> {
  return withReading(`price:${asset}`, async () => {
    const tick = liveSpot(asset);
    if (tick) return toAssetPrice(asset, tick.priceE8, tick.publishTimeSec);
    const base = peekClient()?.priceFeedUrl;
    if (!base) return null;
    let body: LatestBody;
    try {
      body = await latestSnapshot(base);
    } catch (error) {
      throw error instanceof ReadingError ? error : new ReadingError(diagnosis("rpc-down", `price feed unreachable: ${String(error)}`));
    }
    const row = body[asset];
    return row ? toAssetPrice(asset, BigInt(row.priceE8), row.publishTimeSec) : null;
  });
}

/** One point per print time, the lowest source id first when two sources printed the same second. */
export async function getPriceHistory(asset: TickerSymbol, fromSec: number, toSec: number): Promise<Reading<PricePoint[]>> {
  return withReading(`history:${asset}:${fromSec}:${toSec}`, async () => {
    const rows = await indexRows<PrintHistoryRow>(`prints/${asset}`, { from: Math.floor(fromSec), to: Math.ceil(toSec), limit: 1_000 });
    const points: PricePoint[] = [];
    let lastSec = -1;
    for (const row of rows) {
      const atSec = sec(row.source_ts_sec);
      if (atSec === lastSec) continue;
      lastSec = atSec;
      points.push({ priceRaw: BigInt(row.price), emaRaw: BigInt(row.price), publishTimeSec: atSec });
    }
    return points;
  });
}

/** The signed 5-minute archive of a ticker between two instants (D-086): one point per boundary, ascending, on the print scale. */
export async function getArchiveSeries(asset: TickerSymbol, fromSec: number, toSec: number): Promise<Reading<PricePoint[]>> {
  return withReading(`archive:${asset}:${fromSec}:${toSec}`, async () => {
    const rows = await indexRows<ArchiveRow>(`archive/${asset}`, { from: Math.floor(fromSec), to: Math.ceil(toSec), limit: 1_000 });
    return rows.map((row) => ({ priceRaw: BigInt(row.price_e8), emaRaw: BigInt(row.price_e8), publishTimeSec: sec(row.boundary_sec) }));
  });
}
