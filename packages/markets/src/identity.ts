import type { Bytes32 } from "@masayume/core/types";
import {
  binaryModuleReadAbi,
  binarySettlementAbi,
  decodeOutcomeId,
  marketKey,
  outcomeId,
  type DecodedOutcomeId,
  type OutcomeIdx,
} from "@somnia-chain/markets-sdk";
import type { Address, PublicClient } from "viem";
import { resolveAddresses } from "./addresses";

export { decodeOutcomeId, marketKey, outcomeId, type DecodedOutcomeId, type OutcomeIdx };

/**
 * Pinned by Story 1.4 against live Shannon (context/40-reference-basis-and-market-id-2026-09-01.md).
 * The venue keys a market by its bytes32 `marketId` (BinaryMarketsModule.markets(marketId) and the indexer PK);
 * the BinarySettlement singleton keys the same market by `marketKey = yesId >> 8 = (uint160(pool) << 64) | nonce`,
 * which is derivable in-tx from the module record and must never be persisted as a pool address.
 */
export const MARKET_ID_FIELD = "marketId" as const;
export const SETTLEMENT_KEY_FIELD = "marketKey" as const;
/** Decimal scale of the oracle's `numericValue` / `strike` for the BTC and ETH reference questions (prices are posted in cents). */
export const ORACLE_PRICE_SCALE = 2;
/**
 * Which price-feed series tracks the oracle's prints; the chart and Fair Value model must read this one.
 * Over 80 window boundaries the EMA sat a median 0.46 bps from the oracle print (spot 0.68 bps; max 2.62 vs 4.17 bps).
 */
export const PRICE_BASIS: "spot" | "ema" = "ema";

export function marketIdOf(row: { marketId: string }): Bytes32 {
  return row.marketId.toLowerCase() as Bytes32;
}

export function settlementKeyOf(yesId: bigint): bigint {
  return marketKey(yesId);
}

export function outcomeIdsOf(pool: Address, nonce: bigint): { yesId: bigint; noId: bigint } {
  return { yesId: outcomeId(pool, nonce, 0), noId: outcomeId(pool, nonce, 1) };
}

function requireAddress(key: "binaryModule" | "binarySettlement"): Address {
  const address = resolveAddresses()[key];
  if (!address) throw new Error(`${key} address is not configured for this network`);
  return address;
}

/** The module's registry record for a market — the authoritative source of its pool, nonce, and outcome ids. */
export function readModuleMarket(client: PublicClient, marketId: Bytes32) {
  return client.readContract({
    address: requireAddress("binaryModule"),
    abi: binaryModuleReadAbi,
    functionName: "markets",
    args: [marketId],
  });
}

/** The settlement singleton's record, keyed by `marketKey(yesId)`; `finalized` is false until the backing was swept. */
export function readSettlementRecord(client: PublicClient, yesId: bigint) {
  return client.readContract({
    address: requireAddress("binarySettlement"),
    abi: binarySettlementAbi,
    functionName: "getSettlement",
    args: [marketKey(yesId)],
  });
}
