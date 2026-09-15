import { insideNoEntryBuffer, ONCHAIN_STATUS } from "@agari/core/lifecycle";
import { diagnosis, type EventMarket, type OnchainSnapshot } from "@agari/core/types";
import { msToSec } from "@agari/core/units";
import { readMarket, readSeries, readVenue, type SeriesFacts, type VenueFacts } from "../../runtime/accounts";
import { toOnchainSnapshot } from "../../runtime/mappers";
import { OrderRefusedError } from "../errors";

export interface GateResult {
  onchain: OnchainSnapshot;
  series: SeriesFacts;
  venue: VenueFacts;
  /** `Market.trading_start`: the bell a resting call's default expiry counts from (D-088). */
  tradingStartSec: number;
}

/** Which on-chain statuses a lane admits: a taker needs Trading; a post-only call may also rest on a Listed Window (D-088). */
export type GateAdmit = "trading" | "listed-or-trading";

/** `GlobalConfig.mode` Normal: the only mode a user order is admitted in (ReduceOnly 1, Halted 2). */
const MODE_NORMAL = 0;

const notTrading = (technical: string) => new OrderRefusedError(diagnosis("market-not-trading", technical));

/**
 * Head-fresh chain status is the only thing that may admit a write (canon #1): the Market, its Series and the venue
 * read now, never the indexer or a cached snapshot. A read that fails refuses (`rpc-down`) rather than guessing. The
 * snapshot returned feeds every later step, so the whole lane sees one generation of the Window (first-call.md §3.1).
 */
export async function statusGate(market: EventMarket, nowMs: number, admit: GateAdmit = "trading"): Promise<GateResult> {
  let reads: Awaited<ReturnType<typeof readGate>>;
  try {
    reads = await readGate(market);
  } catch (error) {
    const technical = error instanceof Error ? error.message : String(error);
    throw new OrderRefusedError(diagnosis("rpc-down", `could not confirm the Window is trading right now: ${technical}`));
  }
  const [account, series, venue] = reads;
  if (!account) throw notTrading(`Window ${market.marketId} not found`);
  const onchain = toOnchainSnapshot(account, series, venue, msToSec(nowMs));
  const listed = admit === "listed-or-trading" && onchain.status === ONCHAIN_STATUS.Listed;
  if (onchain.status !== ONCHAIN_STATUS.Trading && !listed) throw notTrading(`on-chain status ${onchain.status} is not Trading (${ONCHAIN_STATUS.Trading})${admit === "listed-or-trading" ? " or Listed" : ""}`);
  if (venue.mode !== MODE_NORMAL) throw notTrading(`the venue is in mode ${venue.mode}, not Normal`);
  if (insideNoEntryBuffer(nowMs, { lockAtSec: onchain.lockAtSec, intervalSec: market.intervalSec })) throw notTrading("inside the no-entry buffer before the Window locks");
  return { onchain, series, venue, tradingStartSec: Number(account.data.tradingStart) };
}

function readGate(market: EventMarket) {
  return Promise.all([readMarket(market.marketId), readSeries(market.seriesAddress), readVenue()]);
}
