import type { Attribution } from "@masayume/core/ports";
import type { OnchainSnapshot, Quote, Side } from "@masayume/core/types";
import { ORDER_TYPE, type PlaceOrderResult } from "@somnia-chain/markets-sdk";
import { toBuySide } from "../../mappers/side";
import type { SessionTrader } from "../../sessions/trader";
import { gasLimitFor } from "../gas";

export interface SendOrderInput {
  /** The calling session's own bound trader — never a shared, re-bindable one. */
  trader: SessionTrader;
  onchain: OnchainSnapshot;
  side: Side;
  quote: Quote;
  expireTimestampNs: bigint;
  attribution: Attribution;
}

/**
 * Takers send immediate-or-cancel at the protective limit (canon #7): what crosses fills now and the
 * remainder is cancelled, so no escrow ever rests invisibly. The approval, when short, is absorbed
 * into this same action (autoApprove) — two signatures the first time, never a surprise mid-flow.
 */
export function sendOrder({ trader, onchain, side, quote, expireTimestampNs, attribution }: SendOrderInput): Promise<PlaceOrderResult> {
  return trader.placeOrder({
    pool: onchain.pool,
    side: toBuySide(side),
    price: quote.limitPriceRaw,
    quantity: quote.contractsRaw,
    outcomeToken: onchain.outcomeToken,
    yesId: onchain.yesId,
    noId: onchain.noId,
    collateral: onchain.collateral,
    orderType: ORDER_TYPE.MARKET,
    expireTimestampNs,
    autoApprove: true,
    gas: gasLimitFor("order"),
    ...attribution,
  });
}
