/**
 * A wallet's resting calls (D-088) from the index: the existing `wallet/{addr}/orders?open=1` rows, joined to their
 * Windows' index rows and Series grids, projected by core `restingOrderView`. No new route: an order row names its
 * Window, the Window row names its Series, and the Series facts are cached for the runtime's life.
 */
import { restingOrderView, sortRestingViews, type RestingOrderRow, type RestingOrderView } from "@agari/core/projection";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import { readSeries, readVenueStatic } from "../runtime/accounts";
import { nowMs } from "./clock";
import { indexRows, sec, type MarketRow } from "./index-api";
import { withReading } from "./reading";
import { isListable } from "./rows";

/** More than a seat can ever rest (16 per Window) across the handful of Windows listed at once. */
const OPEN_ORDERS_LIMIT = 200;

export async function listRestingOrders(wallet: Address): Promise<Reading<RestingOrderView[]>> {
  return withReading(`restingOrders:${wallet}`, async () => {
    const [rows, venue] = await Promise.all([indexRows<RestingOrderRow>(`wallet/${wallet}/orders`, { open: 1, limit: OPEN_ORDERS_LIMIT }), readVenueStatic()]);
    const ids = [...new Set(rows.map((row) => row.market))];
    if (ids.length === 0) return [];
    const windows = new Map((await indexRows<MarketRow>("markets", { ids: ids.join(",") })).filter(isListable).map((row) => [row.market, row]));
    const now = nowMs();
    const views: RestingOrderView[] = [];
    for (const row of rows) {
      const w = windows.get(row.market);
      if (!w?.series) continue;
      const series = await readSeries(w.series as Address);
      views.push(
        restingOrderView(
          row,
          {
            marketId: w.market as MarketId,
            asset: w.symbol ?? "",
            intervalSec: w.cadence_sec ?? 0,
            tradingStartSec: sec(w.trading_start_sec),
            lockAtSec: sec(w.lock_at_sec),
            expirySec: sec(w.expiry_sec),
            decimals: venue.decimals,
            grid: { lotBase: series.lotBase, cashUnit: series.cashUnit },
          },
          now,
        ),
      );
    }
    return sortRestingViews(views);
  });
}
