import { formatBaseUnits, formatOracleRaw, isOk, phase, type EventMarket, type Reading } from "@masayume/core";
import { bootMarkets, ensureMarkets, marketsProvider } from "@masayume/markets";
import { ORACLE_PRICE_SCALE } from "@masayume/markets/identity";
import { webEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function describe<T>(reading: Reading<T>): string {
  if (!reading.ok) return `error: ${reading.error.kind} — ${reading.error.technical}`;
  const age = reading.stale ? ` · STALE (${reading.staleReason})` : "";
  return `ok · asOf ${new Date(reading.asOfMs).toISOString()}${age}`;
}

function MarketRow({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const opening = market.openingPriceRaw === null ? "waiting for opening print" : formatOracleRaw(market.openingPriceRaw, ORACLE_PRICE_SCALE);
  return (
    <li>
      {market.asset} · {phase(market, nowMs)} · expires {new Date(market.expirySec * 1000).toISOString()} · open {opening} · vol{" "}
      {formatBaseUnits(market.volumeQuoteRaw, market.decimals)} · {market.tradeCount} trades · {market.marketId.slice(-6)}
    </li>
  );
}

export default async function PortPage() {
  ensureMarkets(webEnv.markets);
  const boot = await bootMarkets(webEnv.markets);
  const venueId = isOk(boot) ? boot.value.venue.venueId : null;
  const lanes = venueId ? await marketsProvider.listLiveLanes(venueId) : null;
  const nowMs = marketsProvider.nowMs();

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 font-mono text-sm">
      <h1 className="text-xl font-semibold">Chain port — live lanes as Reading&lt;LaneSet&gt;</h1>
      <section>
        <h2 className="font-semibold">Boot: {describe(boot)}</h2>
        {isOk(boot) ? (
          <ul>
            <li>clock: offset {boot.value.clock.offsetMs} ms · rtt {boot.value.clock.rttMs} ms · block {boot.value.clock.blockNumber}</li>
            <li>collateral: {boot.value.collateral.symbol} ({boot.value.collateral.decimals} dp) {boot.value.collateral.address}</li>
            <li>venue: source={boot.value.venue.source} · {boot.value.venue.venueId ?? "none"} · {boot.value.venue.liveCount} live</li>
            <li>now (chain-corrected): {new Date(nowMs).toISOString()}</li>
          </ul>
        ) : null}
      </section>
      {lanes ? (
        <section>
          <h2 className="font-semibold">Lanes: {describe(lanes)}</h2>
          {isOk(lanes) ? (
            <div className="flex flex-col gap-4">
              <p>{lanes.value.lanes.length} lanes · {lanes.value.excludedFixedStrike} fixed-strike markets hidden</p>
              {lanes.value.lanes.map((lane) => (
                <div key={lane.intervalSec}>
                  <h3 className="font-semibold">{lane.label} ({lane.intervalSec}s) — {lane.markets.length} live</h3>
                  <ul>
                    {lane.markets.map((market) => (
                      <MarketRow key={market.marketId} market={market} nowMs={nowMs} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <p>No venue resolved — lanes not read.</p>
      )}
    </main>
  );
}
