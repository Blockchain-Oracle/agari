import { formatSessionSpan, sessionCountdown } from "@agari/core/copy";
import { formatCadence, TICKERS, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { useTick } from "@agari/markets/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatDayChange } from "@/features/markets/asset-history/day-change";
import { HISTORY_RANGES, type HistoryRange } from "@/features/markets/asset-history/range";
import { historyDayChange, useAssetHistory, type AssetHistory } from "@/features/markets/asset-history/useAssetHistory";
import { assetPairUnit, assetPriceLine } from "@/features/markets/hero/units";
import type { SourceLabel } from "@/features/markets/price-source/source-label";
import { useMarketSession, type MarketSession } from "@/features/markets/session/useMarketSession";
import { HERO_HEAD, PREOPEN } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { useSessionPhrase, useWhen } from "@/lib/when";
import { ReadingBoundary } from "~/components/portfolio/web/states";
import { TickerPicker } from "../board/LaneTabs";
import { SourceLine } from "../parts/SourceLine";
import { ChartCanvas, HeroPanel } from "./HeroChart";
import { FootBand, ScheduleSeam } from "./HeroFoot";
import { AssetRow, CadenceRow, HeadShell, headStyles, Settles } from "./HeroHead";
import { mkType, useMk } from "./mk";
import { PriceChart } from "./PriceChart";

/** The head's countdown and phrase move by the minute; one shared 30 s beat serves both. */
const CLOCK_TICK_MS = 30_000;
const NO_PAUSES: ReadonlyMap<TickerSymbol, string> = new Map();

interface Props {
  asset: TickerSymbol;
  /** Every ticker the picker offers; the hero follows the rail's pin. */
  tickers: readonly TickerSymbol[];
  onPickAsset: (asset: TickerSymbol | null) => void;
  /** Selects a listed Window for the schedule seam (D-088); absent when a listed Window is already the hero's. */
  onSelect?: (marketId: MarketId) => void;
  /** The listed Window the page has selected: the head names it and counts to its own open. */
  window?: EventMarket | null;
  source?: SourceLabel | null;
}

/** "Last close", or "Pre-market" / "After hours" / "Live" for a moved extended-hours tick. */
function priceWord(session: MarketSession, live: boolean): string {
  if (!live) return SESSION_COPY.hero.lastClose;
  const state = session.status.state;
  return state === "pre" ? SESSION_COPY.hero.extended.pre : state === "post" ? SESSION_COPY.hero.extended.post : SESSION_COPY.hero.extended.live;
}

/**
 * web's HeroAssetChart (D-086/D-088): the hero with no Window in it, or with a listed one — the asset is the page. The
 * head (asset, range tab, last price with its word, the listed Window's line, the source, the day's move; the clock to
 * the open), the ticker picker, the last session's chart against the previous close, and the foot: the session phrase,
 * the last close and — with no Window selected — the schedule seam.
 */
export function HeroAssetChart({ asset, tickers, onPickAsset, onSelect, window = null, source = null }: Props) {
  const session = useMarketSession(asset);
  const [range, setRange] = useState<HistoryRange>("1D");
  const history = useAssetHistory(asset, session, range);
  useTick(CLOCK_TICK_MS);
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  if (!session) return null;
  return (
    <HeroPanel>
      <AssetHead asset={asset} session={session} history={history?.ok ? history.value : null} nowSec={nowSec} range={range} onRange={setRange} window={window} source={source} />
      {tickers.length > 1 ? (
        <View style={styles.pick}>
          <TickerPicker tickers={tickers} basis="regular" paused={NO_PAUSES} ticker={asset} onPick={onPickAsset} />
        </View>
      ) : null}
      <ChartCanvas>
        <ReadingBoundary reading={history} shape="chart" isEmpty={(v) => v.points.length < 2} empty={{ why: SESSION_COPY.hero.noHistory(asset) }}>
          {(v) => <PriceChart key={asset} points={v.points} openingRaw={v.prevClose?.priceRaw ?? null} lineLabel={v.lineIsOpen ? SESSION_COPY.hero.openLine : SESSION_COPY.hero.prevCloseLine} />}
        </ReadingBoundary>
      </ChartCanvas>
      <AssetFoot asset={asset} session={session} history={history?.ok ? history.value : null} nowSec={nowSec} onSelect={window ? undefined : onSelect} />
    </HeroPanel>
  );
}

function AssetHead({ asset, session, history, nowSec, range, onRange, window, source }: { asset: TickerSymbol; session: MarketSession; history: AssetHistory | null; nowSec: number; range: HistoryRange; onRange: (r: HistoryRange) => void; window: EventMarket | null; source: SourceLabel | null }) {
  const mk = useMk();
  const when = useWhen();
  const latest = history?.latest ?? null;
  const live = history !== null && history.liveSec !== null;
  const change = history ? historyDayChange(history) : null;
  const move = change ? formatDayChange(change, asset) : null;
  const countdown = sessionCountdown(session.status, nowSec);
  const clock = window
    ? { label: SESSION_COPY.hero.opensIn, value: formatSessionSpan(window.tradingStartSec - nowSec) }
    : { label: countdown?.kind === "closes" ? SESSION_COPY.hero.closesIn : SESSION_COPY.hero.opensIn, value: countdown ? formatSessionSpan(countdown.remainingSec) : SESSION_COPY.hero.noClock };
  const meta = [mkType.pairMeta, { color: mk.gray400 }];
  return (
    <HeadShell clock={<Settles label={clock.label} value={clock.value} />}>
      <AssetRow asset={asset} label={`${TICKERS[asset].name} · ${asset}`}>
        <CadenceRow accessibilityLabel={SESSION_COPY.hero.rangeGroup} tabs={HISTORY_RANGES.map((r) => ({ key: r, label: r, on: r === range, live: true, onPress: () => onRange(r) }))} />
      </AssetRow>
      <Text style={[mkType.question, { color: mk.ink }]} accessibilityRole="header">
        {latest ? <Text style={{ color: mk.vermilion }}>{assetPriceLine(asset, latest.valueRaw)}</Text> : HERO_HEAD.pair(asset, assetPairUnit(asset))}
      </Text>
      {/* `.meta-soft` ("· as of 16:00 ET") is hidden at phone width (yosuku part-16). */}
      {latest ? <Text style={meta}>{priceWord(session, live)}</Text> : null}
      {window ? <Text style={meta}>{PREOPEN.hero.listedWindow(formatCadence(window.intervalSec), when(window.tradingStartSec))}</Text> : null}
      <SourceLine label={source} textStyle={[meta, styles.source]} />
      <View style={headStyles.distance}>
        {move && change ? (
          <>
            <Text style={[mkType.distanceValue, { color: move.direction === "down" ? mk.loss : mk.profit }]}>
              {move.dollars} · {move.percent}
            </Text>
            <Text style={[mkType.since, { color: mk.gray500 }]}>{SESSION_COPY.hero.since[change.since]}</Text>
          </>
        ) : (
          <Text style={[mkType.distance, { color: mk.gray500 }]}>{latest ? SESSION_COPY.hero.noReference : HERO_HEAD.noPrice}</Text>
        )}
      </View>
    </HeadShell>
  );
}

/** `.mh-foot-line`: the session phrase and the last close (the archive's source drops below 480 px), then the seam. */
function AssetFoot({ asset, session, history, nowSec, onSelect }: { asset: TickerSymbol; session: MarketSession; history: AssetHistory | null; nowSec: number; onSelect?: (marketId: MarketId) => void }) {
  const mk = useMk();
  const when = useWhen();
  const phrase = useSessionPhrase();
  const closeLine = history?.lastClose ? SESSION_COPY.next.lastClose(assetPriceLine(asset, history.lastClose.priceRaw), when(history.lastClose.sec, { clock: true })) : null;
  return (
    <FootBand>
      <View style={styles.footLine}>
        <Text style={[mkType.foot, { color: mk.gray500 }]}>{phrase(session.status, nowSec)}</Text>
        {closeLine ? <Text style={[mkType.foot, { color: mk.gray600 }]}>· {closeLine}</Text> : null}
      </View>
      {onSelect ? <ScheduleSeam asset={asset} session={session} nowSec={nowSec} onSelect={onSelect} opensSec={session.status.nextOpenSec ?? null} /> : null}
    </FootBand>
  );
}

const styles = StyleSheet.create({
  // `.mh-asset-pick`: the picker at the head's inset.
  pick: { paddingHorizontal: 24, paddingBottom: 14 },
  source: { marginTop: 4 },
  footLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, flexShrink: 1 },
});
