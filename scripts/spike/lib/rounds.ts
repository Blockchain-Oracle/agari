import type { Client } from "./boot";

export type MarketRow = Awaited<ReturnType<Client["listPastBinaryMarkets"]>>[number];
export type Resolution = Awaited<ReturnType<Client["getMarketResolution"]>>;

export interface SettledRound {
  market: MarketRow;
  resolution: Resolution;
  openingRaw: bigint;
  closingRaw: bigint;
  tradingStartSec: number;
  expirySec: number;
  intervalSec: number;
  resolvedAtSec: number | null;
}

export function intervalSecOf(market: MarketRow): number {
  return market.intervalSec ? Number(market.intervalSec) : Number(market.expiry) - Number(market.tradingStart);
}

export function cadenceLabel(market: MarketRow): string {
  return market.interval ?? `${intervalSecOf(market)}s`;
}

export const isUpDown = (market: MarketRow): boolean => market.strike === "0";
export const isSettled = (market: MarketRow): boolean =>
  (market.status === "Resolved" || market.status === "Finalized") && !market.voided;

export async function liveCadences(client: Client, venueId: string): Promise<number[]> {
  const live = await client.listLiveBinaryMarkets({ venueId, limit: 50 });
  return [...new Set(live.map(intervalSecOf))].sort((a, b) => a - b);
}

/** Settled up/down rounds spread across every cadence the venue currently runs, each joined with its resolution. */
export async function loadSettledRounds(client: Client, venueId: string, perCadence: number): Promise<SettledRound[]> {
  const rounds: SettledRound[] = [];
  for (const intervalSec of await liveCadences(client, venueId)) {
    const rows = await client.listPastBinaryMarkets({ venueId, intervalSec, limit: perCadence * 2 });
    let taken = 0;
    for (const market of rows.filter(isUpDown).filter(isSettled)) {
      if (taken >= perCadence) break;
      const resolution = await client.getMarketResolution(market.marketId);
      const opening = resolution.openingAnswer?.numericValue;
      const closing = resolution.closingAnswer?.numericValue;
      if (!opening || !closing) continue;
      rounds.push({
        market,
        resolution,
        openingRaw: BigInt(opening),
        closingRaw: BigInt(closing),
        tradingStartSec: Number(market.tradingStart),
        expirySec: Number(market.expiry),
        intervalSec: intervalSecOf(market),
        resolvedAtSec: resolution.closingAnswer?.resolvedAt ? Number(resolution.closingAnswer.resolvedAt) : null,
      });
      taken += 1;
    }
  }
  return rounds;
}
