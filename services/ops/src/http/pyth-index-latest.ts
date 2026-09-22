/**
 * `GET /pyth-index/latest` (S20, D-125): the key's entitlement per valuation index and, for each entitled feed with
 * a sample, the index beside the PreStocks token price of the same name and how far apart they sit, in integer basis
 * points. Bigints travel as decimal strings. `fresh` shares `/prices/latest`'s budget (D-086). A denied feed has an
 * entitlement row and no price row: the hub omits its line rather than showing a dash.
 */
import { referencePremiumBps, type PreIpoSymbol } from "@agari/core/market";
import type { PreStocksSpotFeed } from "../prices/prestocks-spot";
import type { PythIndexSpotFeed } from "../prices/pyth-index-spot";
import type { EntitlementState, PythEntitlementStore } from "../runtime/pyth-entitlement";
import { FRESH_MAX_AGE_SEC } from "./spot-sse";

export interface PythIndexEntitlementWire {
  state: EntitlementState;
  status: number | null;
  checkedAtSec: number | null;
  reason: string | null;
  publishSpacingSec: number | null;
  confBps: number | null;
}

export interface PythIndexRowWire {
  indexE8: string;
  publishTimeSec: number;
  ageSec: number;
  fresh: boolean;
  /** The PreStocks token price of the same name, when the catalogue has been read; null otherwise. */
  tokenPriceE8: string | null;
  /** `(token − index) × 10⁴ / index`, truncated toward zero; null without a token price. */
  premiumBps: number | null;
}

export interface PythIndexLatestBody {
  entitlement: Record<string, PythIndexEntitlementWire>;
  rows: Record<string, PythIndexRowWire>;
}

export function pythIndexLatestBody(store: PythEntitlementStore, index: PythIndexSpotFeed | null, prestocks: PreStocksSpotFeed | null, nowSec = Math.floor(Date.now() / 1000)): PythIndexLatestBody {
  const entitlement: Record<string, PythIndexEntitlementWire> = {};
  for (const f of store.feeds()) entitlement[f.symbol] = { state: f.state, status: f.status, checkedAtSec: f.checkedAtSec, reason: f.reason, publishSpacingSec: f.publishSpacingSec, confBps: f.confBps };
  const rows: Record<string, PythIndexRowWire> = {};
  for (const f of store.entitled()) {
    const s = index?.history(f.symbol as PreIpoSymbol).at(-1);
    if (!s) continue;
    const token = prestocks?.history(f.symbol).at(-1)?.tokenPriceE8 ?? null;
    const ageSec = Math.max(0, nowSec - s.publishTimeSec);
    rows[f.symbol] = {
      indexE8: s.indexE8.toString(),
      publishTimeSec: s.publishTimeSec,
      ageSec,
      fresh: ageSec <= FRESH_MAX_AGE_SEC,
      tokenPriceE8: token === null ? null : token.toString(),
      premiumBps: token === null ? null : referencePremiumBps(token, s.indexE8),
    };
  }
  return { entitlement, rows };
}
