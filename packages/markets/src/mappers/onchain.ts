import type { MarketId, OnchainSnapshot, OutcomeIdx } from "@masayume/core/types";
import type { MarketOnchain } from "@somnia-chain/markets-sdk";
import { lowerAddress } from "./scalars";

/** `winningOutcome` reads 0 on an unresolved market — only a resolved, non-void market has a winner (canon #11). */
export function toOnchainSnapshot(marketId: MarketId, m: MarketOnchain): OnchainSnapshot {
  const winner: OutcomeIdx | null = m.isResolved && !m.isVoided && (m.winningOutcome === 0 || m.winningOutcome === 1) ? m.winningOutcome : null;
  return {
    marketId,
    marketAddress: lowerAddress(m.marketAddress),
    outcomeToken: lowerAddress(m.outcomeToken),
    yesId: m.yesId,
    noId: m.noId,
    pool: lowerAddress(m.pool),
    nonce: m.nonce,
    collateral: lowerAddress(m.collateral),
    status: m.status,
    backing: m.backing,
    finalized: m.finalized,
    expirySec: Number(m.expiry),
    decimals: m.decimals,
    winningOutcome: winner,
    isResolved: m.isResolved,
    isVoided: m.isVoided,
  };
}
