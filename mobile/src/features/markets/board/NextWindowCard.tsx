import { formatSessionSpan, sessionCountdown } from "@agari/core/copy";
import type { TickerSymbol } from "@agari/core/market";
import type { LaneBasis } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { formatDayChange } from "@/features/markets/asset-history/day-change";
import { historyDayChange, useAssetHistory } from "@/features/markets/asset-history/useAssetHistory";
import { assetPriceLine } from "@/features/markets/hero/units";
import { laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import { firstWindowStartSec, nextListedWindow } from "@/features/markets/lanes/next-window";
import type { MarketSession } from "@/features/markets/session/useMarketSession";
import { useVenue } from "@/features/markets/useVenue";
import { formatCadence, HERO_HEAD, PREOPEN } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
import { useWhen } from "@/lib/when";
import { Button, Card, Pill } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TYPE, useTheme } from "~/theme";
import { LiveLine } from "../chart/LiveLine";

/**
 * web's NextWindowCard (D-086): while the stock market is shut, the slot a ticker's live card will take carries its
 * last price, the day's move and the last session's line against the previous close, when the first Window opens, and
 * the schedule seam — a call on the asset's listed Window in this lane, or the line that says when one lists.
 */
export function NextWindowCard({ asset, basis, intervalSec, session, nowSec }: { asset: TickerSymbol; basis: LaneBasis; intervalSec: number; session: MarketSession; nowSec: number }) {
  const { color } = useTheme();
  const when = useWhen();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const historyReading = useAssetHistory(asset, session);
  const history = historyReading?.ok ? historyReading.value : null;
  const cadence = laneCadenceLabel(basis, intervalSec);
  const countdown = sessionCountdown(session.status, nowSec);
  const opensSec = firstWindowStartSec(session, intervalSec);
  const latest = history?.latest ?? null;
  const change = history ? historyDayChange(history) : null;
  const move = change ? formatDayChange(change, asset) : null;
  const next = nextListedWindow(lanes?.ok ? lanes.value : null, asset, nowSec, intervalSec);
  const closesAt = session.open ? session.status.closesAtSec : null;
  const listsLine = closesAt !== null ? PREOPEN.seam.listsAtClose(when(closesAt, { clock: true })) : opensSec ? PREOPEN.seam.listsBeforeOpen(when(opensSec)) : null;

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.asset}>
          <AssetDisc asset={asset} size={28} />
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{asset}</Text>
          <Pill label={cadence} />
        </View>
        <Pill label={countdown?.kind === "opens" ? SESSION_COPY.next.opensIn(formatSessionSpan(countdown.remainingSec)) : SESSION_COPY.next.clock} dot />
      </View>
      <View style={styles.priceRow}>
        <Text style={[TYPE.dataLg, { color: color.ink }]}>{latest ? assetPriceLine(asset, latest.valueRaw) : HERO_HEAD.noPrice}</Text>
        {move ? <Text style={[TYPE.data, { color: move.direction === "down" ? color.loss : color.profit }]}>{move.dollars} · {move.percent}</Text> : null}
      </View>
      {history && history.points.length >= 2 ? <LiveLine points={history.points} strikeRaw={history.prevClose?.priceRaw ?? null} asset={asset} height={56} bare /> : <View style={styles.sparkHold} />}
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        {opensSec !== null ? <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{SESSION_COPY.next.first(cadence, when(opensSec))}. </Text> : null}
        {history?.lastClose ? `${SESSION_COPY.next.lastClose(assetPriceLine(asset, history.lastClose.priceRaw), when(history.lastClose.sec, { clock: true }))}.` : ""}
      </Text>
      {next ? (
        <Button
          label={`${PREOPEN.seam.cta} · ${PREOPEN.seam.which(formatCadence(next.intervalSec), when(next.tradingStartSec))}`}
          size="sm"
          icon={{ ios: "calendar.badge.clock", android: "schedule" }}
          accessibilityHint={PREOPEN.seam.aria(asset, formatCadence(next.intervalSec), when(next.tradingStartSec))}
          onPress={() => router.push({ pathname: "/ticket", params: { m: next.marketId } })}
        />
      ) : listsLine && lanes !== null ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{listsLine}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  asset: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  sparkHold: { height: 56 },
});
