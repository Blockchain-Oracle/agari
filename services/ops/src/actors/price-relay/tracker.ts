/**
 * The Markets a relay still has work on (venue-ops.md §4): Regular Series of registry tickers, and per Series the
 * index range `[lowIndex, nextIndex)`. Print deadlines are at most T + 900 s, so a fresh start looks back 8 Windows.
 */
import { chainNowSec, fetchMarkets, fetchSeries, listSeries, windowAddresses, type MarketView, type OpsClient, type SeriesView } from "@agari/markets/ops";
import { relayFinished } from "@agari/markets/ops/prints";

const SERIES_REFRESH_MS = 5 * 60_000;
const LOOK_BACK = 8n;
const CLOCK_TTL_MS = 5_000;

export type TrackedMarket = { series: SeriesView; market: MarketView };

export class VenueTracker {
  private series: SeriesView[] = [];
  private seriesAtMs = 0;
  private readonly low = new Map<string, bigint>();
  private clock = { chainSec: 0, atMs: 0 };

  constructor(private readonly client: OpsClient) {}

  /** The chain clock, read at most every 5 s and advanced by the wall clock in between. */
  async chainNow(): Promise<number> {
    if (Date.now() - this.clock.atMs > CLOCK_TTL_MS) this.clock = { chainSec: await chainNowSec(this.client), atMs: Date.now() };
    return this.clock.chainSec + Math.floor((Date.now() - this.clock.atMs) / 1000);
  }

  /** Series count and, for a heartbeat, the keys acted on. */
  seriesCount(): number {
    return this.series.length;
  }

  /** `live`: Markets with an admissible or future empty slot. `finished`: still-open Markets whose empty slots are all past their deadlines (for the missed report). */
  async read(nowSec: number): Promise<{ live: TrackedMarket[]; finished: TrackedMarket[] }> {
    if (Date.now() - this.seriesAtMs > SERIES_REFRESH_MS || this.series.length === 0) {
      this.series = (await listSeries(this.client)).filter((s) => s.symbol !== null && s.data.basis === 0);
      this.seriesAtMs = Date.now();
    }
    const fresh = (await fetchSeries(this.client, this.series.map((s) => s.address))).filter((s): s is SeriesView => s !== null);
    const wanted: Array<{ series: SeriesView; index: bigint; address: string }> = [];
    for (const s of fresh) {
      const next = s.data.nextIndex;
      const floor = next > LOOK_BACK ? next - LOOK_BACK : 0n;
      const low = this.low.get(s.address) ?? floor;
      for (let i = low > floor ? low : floor; i < next; i++) wanted.push({ series: s, index: i, address: (await windowAddresses(s.address, i)).market });
    }
    const markets = await fetchMarkets(this.client, wanted.map((w) => w.address as never));
    const live: TrackedMarket[] = [];
    const finished: TrackedMarket[] = [];
    const advancing = new Map<string, boolean>();
    wanted.forEach((w, i) => {
      const market = markets[i];
      const done = !market || relayFinished(w.series, market, nowSec);
      if (advancing.get(w.series.address) !== false && done) this.low.set(w.series.address, w.index + 1n);
      else advancing.set(w.series.address, false);
      if (market && !done) live.push({ series: w.series, market });
      else if (market) finished.push({ series: w.series, market });
    });
    return { live, finished };
  }
}
