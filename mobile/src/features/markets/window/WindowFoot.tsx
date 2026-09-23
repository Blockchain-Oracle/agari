import { formatCadence } from "@agari/core/copy";
import { isTickerSymbol } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { HERO_HEAD } from "@/lib/copy";
import { Button } from "~/components/kit";
import { DropBellToggle } from "~/features/hedge/DropBell";
import { MarketRoomSheet } from "~/features/room/MarketRoomSheet";

/** web's `roomCallLabel`: the question the Room is about, and which Window that was. */
function roomCallLabel(market: EventMarket, openingRaw: bigint | null): string {
  const cadence = formatCadence(market.intervalSec);
  if (openingRaw === null) return `${market.asset} · ${cadence}`;
  return `${HERO_HEAD.holdsAbove(market.asset)} ${assetPriceLine(market.asset, openingRaw)}? · ${cadence}`;
}

/**
 * web's HeroChartFoot actions: The Room (bettors only) opened as its sheet over the Window, and the price alert beside
 * it — the drop bell, rung on this phone by the root watcher. The Room's "bet" opens this Window's ticket.
 */
export function WindowFoot({ market, openingRaw }: { market: EventMarket; openingRaw: bigint | null }) {
  const [room, setRoom] = useState(false);
  return (
    <View style={styles.wrap}>
      <Button
        label={`${HERO_HEAD.room} · ${HERO_HEAD.roomQualifier}`}
        variant="secondary"
        size="sm"
        icon={{ ios: "bubble.left.and.bubble.right", android: "forum" }}
        onPress={() => setRoom(true)}
      />
      {isTickerSymbol(market.asset) ? <DropBellToggle asset={market.asset} /> : null}
      <MarketRoomSheet
        visible={room}
        marketId={market.marketId}
        asset={market.asset}
        callLabel={roomCallLabel(market, openingRaw)}
        onClose={() => setRoom(false)}
        onBet={() => {
          setRoom(false);
          router.push({ pathname: "/ticket", params: { m: market.marketId } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: 8 } });
