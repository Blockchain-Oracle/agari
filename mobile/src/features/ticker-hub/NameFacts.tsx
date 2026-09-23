import type { TickerSymbol } from "@agari/core/market";
import { useAssetPrice, useLanes } from "@agari/markets/react";
import { router } from "expo-router";
import { assetPriceLine, basisRaw, feedRawToOracleRaw, usdLine } from "@/features/markets/hero/units";
import { assetSourceLabel } from "@/features/markets/price-source/source-label";
import { useVenue } from "@/features/markets/useVenue";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import { usePreIpoFacts, type PreIpoFactsView } from "@/features/ticker-hub/usePreIpoFacts";
import type { PythIndexRow } from "@/features/ticker-hub/usePythIndex";
import { useNextEarnings } from "@/features/ticker-hub/useTickerNews";
import { TickerRoomButton } from "~/features/room/TickerRoomButton";
import { LinkButton, SourceLine, Stat, StatBar } from "./HubParts";

/** "Tue, Oct 21 · after close" from an ET calendar date; noon UTC keeps the weekday right in every zone (web's `reportDay`). */
function reportDay(dateEt: string, hour: keyof typeof TICKER_HUB.hour | null): string {
  const day = new Date(`${dateEt}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return hour ? `${day} · ${TICKER_HUB.hour[hour]}` : day;
}

/** web's `PreIpoStats`: token price · PreStocks mark · Pyth index (only when present) · the premiums · holders. */
function PreIpoFigures({ spot, spotStale, facts, index }: { spot: string; spotStale: boolean; facts: PreIpoFactsView | null; index: PythIndexRow | null }) {
  const t = TICKER_HUB.preIpo;
  return (
    <>
      <Stat label={spotStale ? `${t.tokenPrice} · ${TICKER_HUB.spotStale}` : t.tokenPrice} value={spot} />
      <Stat label={t.mark} value={facts?.markPriceE8 !== undefined ? usdLine(facts.markPriceE8) : TICKER_HUB.dash} />
      {index ? <Stat label={t.index} value={usdLine(index.indexE8)} /> : null}
      <Stat label={t.premium} value={typeof facts?.premiumBps === "number" ? t.premiumLine(facts.premiumBps) : TICKER_HUB.dash} />
      {index && index.premiumBps !== null ? <Stat label={t.indexPremium} value={t.premiumLine(index.premiumBps)} /> : null}
      <Stat
        label={t.holders}
        value={facts && facts.holders !== null ? t.holdersLine(facts.holders, facts.holdersMonthAgo) : TICKER_HUB.dash}
        long
      />
    </>
  );
}

/**
 * web's `NameFacts` (features/ticker-hub/TickerHubScreen.tsx): a listed name's spot and next report, or a pre-IPO
 * name's PreStocks facts, then the source line, the ticker's Room and "Trade it →". The spot is the one shared price
 * stream; the lane read is the markets tab's own cache entry.
 */
export function NameFacts({ symbol, preIpo, index }: { symbol: TickerSymbol; preIpo: boolean; index: PythIndexRow | null }) {
  const price = useAssetPrice(symbol);
  const earnings = useNextEarnings(preIpo ? null : symbol);
  const facts = usePreIpoFacts(preIpo ? symbol : null);
  const venue = useVenue();
  const lanes = useLanes(preIpo ? null : venue.venueId);
  const source = assetSourceLabel(symbol, lanes?.ok ? lanes.value : null);
  const spot = price?.ok && price.value ? assetPriceLine(symbol, feedRawToOracleRaw(basisRaw(price.value), price.value.decimals)) : TICKER_HUB.dash;
  const stale = Boolean(price?.ok && price.stale);
  const report = earnings.event
    ? reportDay(earnings.event.dateEt, earnings.event.hour)
    : earnings.known
      ? TICKER_HUB.earningsNone
      : TICKER_HUB.earningsUnknown;
  const t = TICKER_HUB.preIpo;

  const foot = preIpo ? (
    <SourceLine label={source} tail={index ? t.sourceBoth : t.sourcePreStocksOnly} />
  ) : source ? (
    <SourceLine label={source} />
  ) : null;

  return (
    <StatBar
      foot={foot}
      actions={
        <>
          <TickerRoomButton symbol={symbol} />
          <LinkButton label={TICKER_HUB.trade} icon onPress={() => router.push("/markets")} />
        </>
      }
    >
      {preIpo ? (
        <PreIpoFigures spot={spot} spotStale={stale} facts={facts?.ok ? facts.value : null} index={index} />
      ) : (
        <>
          <Stat label={stale ? `${TICKER_HUB.spot} · ${TICKER_HUB.spotStale}` : TICKER_HUB.spot} value={spot} />
          <Stat label={TICKER_HUB.earnings} value={report} mono={false} />
        </>
      )}
    </StatBar>
  );
}
