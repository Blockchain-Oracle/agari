import { CADENCE_SNAP_TOLERANCE_SEC } from "@masayume/core/constants";
import { toMarketId, type EventMarket, type OutcomeIdx } from "@masayume/core/types";
import { resolveIntervalSec, snapIntervalSec, type BinaryMarket } from "@somnia-chain/markets-sdk";
import { bigintOf, bigintOrZero, lowerAddress, numberOf, secToMsOrNull } from "./scalars";

function outcomeOf(value: number | null | undefined): OutcomeIdx | null {
  return value === 0 || value === 1 ? value : null;
}

/** A series' first market is a bootstrap partial (298 s of a 300 s cadence); snap so it joins its lane instead of creating a phantom one. */
function cadenceOf(row: BinaryMarket, tradingStartSec: number, expirySec: number): number {
  const raw = resolveIntervalSec(row) ?? Math.max(1, expirySec - tradingStartSec);
  return snapIntervalSec(raw, CADENCE_SNAP_TOLERANCE_SEC);
}

export function toEventMarket(row: BinaryMarket, openingPriceRaw: bigint | null): EventMarket {
  const tradingStartSec = numberOf(row.tradingStart) ?? 0;
  const expirySec = numberOf(row.expiry) ?? 0;
  const strikeRaw = bigintOrZero(row.strike);
  return {
    marketId: toMarketId(row.marketId),
    venueId: row.venueId ?? null,
    asset: row.asset,
    question: row.question,
    intervalSec: cadenceOf(row, tradingStartSec, expirySec),
    strikeRaw,
    isUpDown: strikeRaw === 0n,
    tradingStartSec,
    expirySec,
    poolAddress: lowerAddress(row.poolAddress),
    marketAddress: lowerAddress(row.marketAddress),
    nonce: bigintOf(row.nonce),
    yesTokenId: bigintOrZero(row.yesTokenId),
    noTokenId: bigintOrZero(row.noTokenId),
    collateral: lowerAddress(row.collateral),
    decimals: row.quoteDecimals,
    status: row.status,
    winningOutcome: outcomeOf(row.winningOutcome),
    voided: row.voided,
    finalized: row.finalized ?? null,
    openingPriceRaw,
    oracleQuestionId: row.oracleQuestionId ?? null,
    volumeQuoteRaw: bigintOrZero(row.cumulativeQuoteVolume),
    tradeCount: numberOf(row.tradeCount) ?? 0,
    lastPriceRaw: bigintOf(row.lastPrice),
    resolvedAtMs: secToMsOrNull(row.resolvedAtTimestamp),
  };
}
