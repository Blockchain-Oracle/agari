import { countdown } from "@agari/core/lifecycle";
import type { EventMarket, Side } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { laneAssetLabel, laneTabLabel } from "@/features/markets/lanes/lane-view";
import { Card, haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { SideButtons } from "~/components/window/SideButtons";
import { TYPE, useTheme } from "~/theme";

interface WindowCardProps {
  market: EventMarket;
  nowMs: number;
  /** Called before leaving for the ticket or the Window (a sheet closes itself). */
  onLeave?: () => void;
  /** "per $1" under the prices (Sensei's cards). */
  note?: string;
}

/**
 * A live Window as a compact card — web's `MarketCard` / Sensei's trade card in one: the mark, the Window's name, the
 * line and the clock, then Up / Down at the book's own prices. A side opens the one Ticket with it chosen; the head
 * opens the Window (two separate controls, so VoiceOver reaches both). Nothing is signed from here.
 */
export function WindowCard({ market, nowMs, onLeave, note }: WindowCardProps) {
  const { color } = useTheme();
  const book = useTopOfBook(market);
  const clock = nowMs > 0 ? countdown(nowMs, market.expirySec, market.intervalSec) : null;
  const line = market.openingPriceRaw === null ? "—" : assetPriceLine(market.asset, market.openingPriceRaw);
  const name = `${laneAssetLabel(market.asset, market.lane)} · ${laneTabLabel(market.lane, market.intervalSec)}`;
  const pick = (side: Side) => {
    onLeave?.();
    router.push({ pathname: "/ticket", params: { m: market.marketId, dir: side } });
  };
  return (
    <Card>
      <Pressable
        onPress={() => {
          haptic.tap();
          onLeave?.();
          router.push(`/markets/${market.marketId}`);
        }}
        accessibilityRole="link"
        accessibilityLabel={`Open ${name}`}
        style={styles.head}
      >
        <AssetDisc asset={market.asset} size={30} />
        <View style={styles.headText}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{name}</Text>
          <Text style={[TYPE.data, { color: color.inkSecondary }]}>{line}</Text>
        </View>
        <Text style={[TYPE.dataLg, { color: clock?.urgent ? color.accent : color.ink }]}>
          {clock ? formatClock(clock.remainingSec) : "—"}
        </Text>
      </Pressable>
      <SideButtons upCents={book.upCents} downCents={book.downCents} onPick={pick} />
      {note ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{note}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  headText: { flex: 1, gap: 2 },
});
