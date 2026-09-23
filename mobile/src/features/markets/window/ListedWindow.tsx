import { formatCadence, formatSessionSpan } from "@agari/core/copy";
import { TICKERS, isTickerSymbol } from "@agari/core/market";
import type { EventMarket, Side } from "@agari/core/types";
import { StyleSheet, Text, View } from "react-native";
import { formatDayChange } from "@/features/markets/asset-history/day-change";
import { historyDayChange, useAssetHistory } from "@/features/markets/asset-history/useAssetHistory";
import { assetPriceLine } from "@/features/markets/hero/units";
import { windowSourceLabel } from "@/features/markets/price-source/source-label";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { HERO_HEAD, PREOPEN } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { SESSION_COPY } from "@/lib/copy-session";
import { useWhen } from "@/lib/when";
import { Button, EmptyState, ReadingView } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TYPE, useTheme } from "~/theme";
import { LiveLine } from "../chart/LiveLine";
import { NATIVE_MARKETS } from "../copy";
import { SessionChip } from "../parts/SessionChip";
import { SourceLine } from "../parts/SourceLine";

/**
 * A Regular or Gap Window listed before its bell (web's HeroAssetChart with a listed Window, D-086/D-088): the asset is
 * the page — its last price and day's move over the last session's signed archive against the previous close — the
 * head names this Window and counts to its own open, and the two calls open the schedule ticket (a post-only call at
 * your price, the app's limit order).
 */
export function ListedWindow({ market, nowMs, onPick }: { market: EventMarket; nowMs: number; onPick: (side: Side) => void }) {
  const { color } = useTheme();
  const when = useWhen();
  const session = useMarketSession(market.asset);
  const history = useAssetHistory(market.asset, session);
  const name = isTickerSymbol(market.asset) ? TICKERS[market.asset].name : market.asset;
  const nowSec = Math.floor(nowMs / 1000);
  const h = history?.ok ? history.value : null;
  const change = h ? historyDayChange(h) : null;
  const move = change ? formatDayChange(change, market.asset) : null;
  const price = h?.latest ?? null;

  return (
    <View style={styles.wrap}>
      <View style={styles.assetRow}>
        <AssetDisc asset={market.asset} size={34} />
        <Text style={[TYPE.title, styles.name, { color: color.ink }]} numberOfLines={1}>
          {name} · {market.asset}
        </Text>
      </View>
      <SessionChip asset={market.asset} />
      <Text style={[TYPE.labelMicro, { color: color.accent }]}>{PREOPEN.hero.listedWindow(formatCadence(market.intervalSec), when(market.tradingStartSec))}</Text>
      <Text style={[TYPE.dataHero, { color: color.ink }]}>{price ? assetPriceLine(market.asset, price.valueRaw) : HERO_HEAD.pair(market.asset)}</Text>
      {price ? (
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {h?.liveSec ? SESSION_COPY.hero.extended.live : SESSION_COPY.hero.lastClose} · {SESSION_COPY.hero.asOf(when(price.timeSec, { clock: true }))}
        </Text>
      ) : null}
      {move && change ? (
        <Text style={[TYPE.bodyStrong, { color: move.direction === "down" ? color.loss : color.profit }]}>
          {move.dollars} · {move.percent} <Text style={{ color: color.inkMuted }}>{SESSION_COPY.hero.since[change.since]}</Text>
        </Text>
      ) : (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{price ? SESSION_COPY.hero.noReference : HERO_HEAD.noPrice}</Text>
      )}
      <SourceLine label={windowSourceLabel(market)} />
      <ReadingView reading={history} loading="chart">
        {(v) =>
          v.points.length < 2 ? (
            <EmptyState why={SESSION_COPY.hero.noHistory(market.asset)} />
          ) : (
            <LiveLine
              points={v.points}
              strikeRaw={v.prevClose?.priceRaw ?? null}
              asset={market.asset}
              height={200}
              lineLabel={v.lineIsOpen ? SESSION_COPY.hero.openLine : SESSION_COPY.hero.prevCloseLine}
            />
          )
        }
      </ReadingView>
      <View style={[styles.opens, { borderColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{NATIVE_MARKETS.opensIn}</Text>
        <Text style={[TYPE.dataLg, { color: color.ink }]}>{nowSec > 0 ? formatSessionSpan(Math.max(0, market.tradingStartSec - nowSec)) : "—"}</Text>
      </View>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{NATIVE_MARKETS.listedLead}</Text>
      <View style={styles.calls}>
        <Button label={CLOSED.callUp} variant="profit" size="lg" icon={{ ios: "arrow.up", android: "arrow_upward" }} onPress={() => onPick("up")} style={styles.call} />
        <Button label={CLOSED.callDown} variant="loss" size="lg" icon={{ ios: "arrow.down", android: "arrow_downward" }} onPress={() => onPick("down")} style={styles.call} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flexShrink: 1 },
  opens: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, marginTop: 4 },
  calls: { flexDirection: "row", gap: 10 },
  call: { flex: 1 },
});
