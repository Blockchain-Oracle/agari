import { enumerateClaimables, type SettledHolding, type SettledMarket } from "@masayume/core/claims";
import type { Reading } from "@masayume/core/schemas";
import { toMarketId, type Address, type Bytes32, type ClaimableRow, type Holdings, type MarketId } from "@masayume/core/types";
import type { PortfolioMarket, PortfolioPosition } from "@somnia-chain/markets-sdk";
import { getClient } from "../runtime/read-runtime";
import { bigintOf, lowerAddress, numberOf } from "../mappers/scalars";
import { settlementFeeBps } from "./fees";
import { SETTLED_STATUSES } from "./markets";
import { resolveOutcomeToken } from "./outcome-token";
import { withReading } from "./reading";

interface SettledPosition {
  market: SettledMarket;
  tokenIds: { up: bigint | null; down: bigint | null };
}

function toSettledMarket(market: PortfolioMarket): SettledMarket {
  return {
    marketId: toMarketId(market.id),
    marketAddress: lowerAddress(market.marketAddress),
    asset: market.asset,
    intervalSec: numberOf(market.intervalSec) ?? 0,
    expirySec: numberOf(market.expiry) ?? 0,
    decimals: market.quoteDecimals,
    voided: market.voided,
    winningOutcome: market.winningOutcome === 0 || market.winningOutcome === 1 ? market.winningOutcome : null,
    resolvedAtMs: null,
  };
}

/** The wallet's own non-zero positions, grouped by market and narrowed to settled ones — never a venue page (NFR-4). */
function settledPositions(positions: readonly PortfolioPosition[]): SettledPosition[] {
  const byMarket = new Map<MarketId, SettledPosition>();
  for (const position of positions) {
    if (!SETTLED_STATUSES.has(position.market.status)) continue;
    const marketId = toMarketId(position.market.id);
    const entry = byMarket.get(marketId) ?? { market: toSettledMarket(position.market), tokenIds: { up: null, down: null } };
    if (position.outcomeIndex === 0) entry.tokenIds.up = bigintOf(position.tokenId);
    if (position.outcomeIndex === 1) entry.tokenIds.down = bigintOf(position.tokenId);
    byMarket.set(marketId, entry);
  }
  return [...byMarket.values()];
}

/** Head-fresh ERC-6909 balances for the held ids; an unheld side is 0 without a read. */
async function holdingsFor(wallet: Address, settled: readonly SettledPosition[], token: Address): Promise<Holdings[]> {
  const ids = settled.flatMap(({ tokenIds }) => [tokenIds.up, tokenIds.down]).filter((id): id is bigint => id !== null);
  const balances = await getClient().getBalances(
    ids.map((id) => ({ token, id })),
    wallet,
  );
  let cursor = 0;
  const next = (id: bigint | null): bigint => (id === null ? 0n : (balances[cursor++] ?? 0n));
  return settled.map(({ tokenIds }) => ({ upRaw: next(tokenIds.up), downRaw: next(tokenIds.down) }));
}

/** Claimables discovered from the wallet's positions (never a row-capped venue scan), fee read at use time (canon #10, #11, #15). `venueId` only keys the cache. */
export async function listClaimables(wallet: Address, venueId: Bytes32): Promise<Reading<ClaimableRow[]>> {
  return withReading(`claimables:${wallet}:${venueId}`, async (inner) => {
    const portfolio = await getClient().getPortfolio(wallet, { ordersLimit: 0, tradesLimit: 0 });
    const settled = settledPositions(portfolio.positions);
    const first = settled[0];
    if (!first) return [];

    const token = await resolveOutcomeToken(inner, first.market.marketId);
    const [holdings, fees] = await Promise.all([
      holdingsFor(wallet, settled, token),
      Promise.all(settled.map(({ market }) => settlementFeeBps(market.marketId))),
    ]);
    const inputs: SettledHolding[] = settled.map(({ market }, i) => ({
      market,
      holdings: holdings[i] ?? { upRaw: 0n, downRaw: 0n },
      feeBps: inner(fees[i] as Reading<number>),
    }));
    return enumerateClaimables(inputs);
  });
}
