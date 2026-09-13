import { ONCHAIN_STATUS } from "@masayume/core/lifecycle";
import { diagnosis, type MarketId, type OnchainSnapshot } from "@masayume/core/types";
import { ReadingError } from "../../errors/reading-error";
import { getOnchain } from "../../provider/onchain";
import { OrderRefusedError } from "../errors";

/**
 * Head-fresh chain status is the only thing that may admit a write (canon #1): the indexer lags the
 * timestamp-implicit transitions, and a last-good snapshot is refused rather than trusted.
 * The snapshot returned here feeds every later step so the whole lane sees one generation of the pool.
 */
export async function statusGate(marketId: MarketId): Promise<OnchainSnapshot> {
  const reading = await getOnchain(marketId);
  if (!reading.ok) throw new ReadingError(reading.error);
  if (reading.stale) throw new OrderRefusedError(diagnosis("rpc-down", "could not confirm the window is trading right now"));
  const onchain = reading.value;
  if (onchain.status !== ONCHAIN_STATUS.Trading) {
    throw new OrderRefusedError(diagnosis("market-not-trading", `on-chain status ${onchain.status} is not Trading (${ONCHAIN_STATUS.Trading})`));
  }
  return onchain;
}
