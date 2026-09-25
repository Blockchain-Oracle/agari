import { formatSessionSpan, sessionCountdown } from "@agari/core/copy";
import type { TickerSymbol } from "@agari/core/market";
import type { LaneBasis, MarketId } from "@agari/core/types";
import { useLanes } from "@agari/markets/react";
import { useMemo } from "react";
import { Text, View } from "react-native";
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
import { useTheme } from "~/theme";
import { lanesTokens } from "~/theme/web/markets-lanes";
import { card } from "./card-styles";
import { CardHead, Pending, RoomStrip } from "./CardParts";
import { CardSpark } from "./CardSpark";

interface NextWindowCardProps {
  asset: TickerSymbol;
  basis: LaneBasis;
  intervalSec: number;
  session: MarketSession;
  nowSec: number;
  /** Selects a listed Window from the schedule seam (D-088). */
  onSelect: (marketId: MarketId) => void;
}

/**
 * The Window that lists next, in the slot its live card will take (D-086) — web's NextWindowCard: the pending card
 * (`[data-next]`) carrying the last price, the day's move and the last session's spark against the previous close, when
 * the first Window opens, and the schedule seam in the Room strip's slot — a call on the asset's listed Window in this
 * lane (web ScheduleCallButton `strip`), or the line that says when one lists.
 */
export function NextWindowCard({ asset, basis, intervalSec, session, nowSec, onSelect }: NextWindowCardProps) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const when = useWhen();
  const reading = useAssetHistory(asset, session);
  const history = reading?.ok ? reading.value : null;
  const cadence = laneCadenceLabel(basis, intervalSec);
  const countdown = sessionCountdown(session.status, nowSec);
  const opensSec = firstWindowStartSec(session, intervalSec);
  const latest = history?.latest ?? null;
  const change = history ? historyDayChange(history) : null;
  const move = change ? formatDayChange(change, asset) : null;
  const lastClose = history?.lastClose ? ` ${SESSION_COPY.next.lastClose(assetPriceLine(asset, history.lastClose.priceRaw), when(history.lastClose.sec, { clock: true }))}.` : null;
  return (
    <View style={[card.article, { backgroundColor: t.pendingBg, borderColor: t.pendingBorder }]}>
      <CardHead
        asset={asset}
        ticker={asset}
        cadence={cadence}
        clockTone="quiet"
        clock={countdown?.kind === "opens" ? SESSION_COPY.next.opensIn(formatSessionSpan(countdown.remainingSec)) : SESSION_COPY.next.clock}
      />
      <View style={[card.body, { paddingBottom: 0 }]}>
        <View style={card.pricebar}>
          <View style={card.px}>
            <Text style={[card.big, { color: t.ink }]}>{latest ? assetPriceLine(asset, latest.valueRaw) : HERO_HEAD.noPrice}</Text>
            {move ? (
              <Text style={[card.chg, { color: move.direction === "down" ? t.loss : t.profit }]}>
                {move.dollars} · {move.percent}
              </Text>
            ) : null}
          </View>
        </View>
        <CardSpark points={history?.points ?? []} openingRaw={history?.prevClose?.priceRaw ?? null} />
      </View>
      <Pending compact strong={opensSec !== null ? `${SESSION_COPY.next.first(cadence, when(opensSec))}.` : null} rest={lastClose} />
      <ScheduleStrip asset={asset} session={session} nowSec={nowSec} intervalSec={intervalSec} opensSec={opensSec} onSelect={onSelect} />
    </View>
  );
}

/** web ScheduleCallButton, `strip` variant: the `.mc-room` control on the next listed Window, or `.mc-lists` saying when one lists. */
function ScheduleStrip({ asset, session, nowSec, intervalSec, opensSec, onSelect }: { asset: TickerSymbol; session: MarketSession; nowSec: number; intervalSec: number; opensSec: number | null; onSelect: (marketId: MarketId) => void }) {
  const { name } = useTheme();
  const when = useWhen();
  const { venueId } = useVenue();
  const lanes = useLanes(venueId);
  const laneSet = lanes?.ok ? lanes.value : null;
  const next = useMemo(() => nextListedWindow(laneSet, asset, nowSec, intervalSec), [laneSet, asset, nowSec, intervalSec]);
  if (lanes === null) return null;
  if (next) {
    const cadence = formatCadence(next.intervalSec);
    return (
      <RoomStrip
        label={PREOPEN.seam.cta}
        hint={PREOPEN.seam.which(cadence, when(next.tradingStartSec))}
        accessibilityLabel={PREOPEN.seam.aria(asset, cadence, when(next.tradingStartSec))}
        onPress={() => onSelect(next.marketId)}
      />
    );
  }
  const closesAt = session.open ? session.status.closesAtSec : null;
  const line = closesAt !== null && closesAt !== undefined ? PREOPEN.seam.listsAtClose(when(closesAt, { clock: true })) : opensSec ? PREOPEN.seam.listsBeforeOpen(when(opensSec)) : null;
  if (line === null) return null;
  return <Text style={[card.lists, { color: lanesTokens(name).inkMuted }]}>{line}</Text>;
}
