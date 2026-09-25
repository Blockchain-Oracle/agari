import { isRestable } from "@agari/core/lifecycle";
import { LAUNCH_TICKERS, type TickerSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { StyleSheet, View } from "react-native";
import type { LanesState } from "@/features/markets/lanes/useLanes";
import { nextListedWindow } from "@/features/markets/lanes/next-window";
import { assetSourceLabel, windowSourceLabel } from "@/features/markets/price-source/source-label";
import { useWindowPhase } from "@/features/markets/ticket/useTicket";
import { ErrorState, LoadingState } from "~/components/portfolio/web/states";
import { HERO_TOP } from "~/theme/web/markets";
import { HeroAssetChart } from "./HeroAssetChart";
import { HeroChart, HeroPanel } from "./HeroChart";
import { useMk } from "./mk";
import type { HeroSelection } from "./useHeroSelection";

/** The hero's asset when no Window is selected: the rail's pinned ticker, else the registry's first launch ticker. */
const DEFAULT_ASSET: TickerSymbol = LAUNCH_TICKERS[0] ?? "TSLA";

/** A selected Window listed but not yet open on the Regular or Gap lane (D-088); the index's status stands in before the first tick. */
function isListedSelection(market: EventMarket | null, phase: ReturnType<typeof useWindowPhase>): market is EventMarket {
  if (!market || market.lane === "token") return false;
  return phase ? isRestable(phase) : market.status === "Listed";
}

interface Props {
  selection: HeroSelection;
  lanes: LanesState;
  onSelect: (marketId: MarketId, side?: Side) => void;
  onOpenRoom: () => void;
}

/**
 * web's MarketsHero on a phone (`section.page-hero.markets-hero`): the market you are betting on is the page. A live
 * Window is the question, its chart and the call; a listed one (and no Window at all) is the asset hero with the last
 * session's chart (D-086/D-088). Before the lanes read, the panel holds the chart's place: loading, or the diagnosis.
 * The ticket is the drawer the call opens (the /ticket sheet), as below 1024 px on web.
 */
export function MarketsHero({ selection, lanes, onSelect, onOpenRoom }: Props) {
  const mk = useMk();
  const laneList = lanes.laneSet?.lanes ?? [];
  const { market } = selection;
  const phase = useWindowPhase(market, selection.nowMs);
  const listed = isListedSelection(market, phase);
  const nowSec = Math.floor((selection.nowMs > 0 ? selection.nowMs : marketsProvider.nowMs()) / 1000);
  // The picker offers only assets with a listed Window in the same cadence, so every pick resolves to a Window.
  const listedTickers = listed ? LAUNCH_TICKERS.filter((ticker) => nextListedWindow(lanes.laneSet, ticker, nowSec, market.intervalSec) !== null) : LAUNCH_TICKERS;
  const pickListed = (ticker: TickerSymbol | null) => {
    lanes.pinTicker(ticker);
    const next = ticker && listed ? nextListedWindow(lanes.laneSet, ticker, nowSec, market.intervalSec) : null;
    if (next) onSelect(next.marketId);
  };

  return (
    <View style={[styles.hero, { borderBottomColor: mk.heroRule }]}>
      {listed ? (
        <HeroAssetChart asset={market.asset as TickerSymbol} tickers={listedTickers} onPickAsset={pickListed} window={market} source={windowSourceLabel(market)} />
      ) : market ? (
        <HeroChart
          market={market}
          nowMs={selection.nowMs}
          lanes={laneList}
          activeLaneKey={lanes.activeKey}
          pinnedMissingKey={lanes.pinnedMissing ? lanes.activeKey : null}
          onPin={lanes.pin}
          onSelect={onSelect}
          onOpenRoom={onOpenRoom}
        />
      ) : lanes.laneSet ? (
        <HeroAssetChart
          asset={lanes.ticker ?? DEFAULT_ASSET}
          tickers={LAUNCH_TICKERS}
          onPickAsset={lanes.pinTicker}
          onSelect={onSelect}
          source={assetSourceLabel(lanes.ticker ?? DEFAULT_ASSET, lanes.laneSet)}
        />
      ) : (
        <HeroPanel>
          <View style={styles.empty}>
            {lanes.reading !== null && !isOk(lanes.reading) ? <ErrorState diagnosis={lanes.reading.error} retry={lanes.retry} style={styles.fill} /> : <LoadingState shape="chart" label="Loading live Windows" style={styles.fill} />}
          </View>
        </HeroPanel>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // `.markets-hero`: 116 px under web's fixed chrome, 24 below, the hairline; `.container`'s 18 px gutter.
  hero: { paddingTop: HERO_TOP, paddingBottom: 24, paddingHorizontal: 18, borderBottomWidth: 1 },
  // `.mh-hero-empty` at the phone panel's 400 px floor.
  empty: { minHeight: 400, alignItems: "center", justifyContent: "center", padding: 24 },
  fill: { alignSelf: "stretch" },
});
