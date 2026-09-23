import { isTickerSymbol } from "@agari/core/market";
import { isMarketId } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import { useLocalSearchParams } from "expo-router";
import { SenseiScreen } from "~/features/sensei/SenseiScreen";

/**
 * `/sensei` — the market assistant as a sheet over whatever is open. `?m=<marketId>` (a Window) or `?asset=<TICKER>`
 * (a hub) focuses the read on that stock's Windows; with neither it reads the nearest Windows on the venue, as web's
 * dock does.
 */
export default function SenseiSheet() {
  const { m, asset } = useLocalSearchParams<{ m?: string; asset?: string }>();
  const market = useMarket(m && isMarketId(m) ? m : null);
  const fromMarket = market?.ok ? market.value?.asset : undefined;
  const symbol = asset ?? fromMarket;
  return <SenseiScreen focus={isTickerSymbol(symbol) ? symbol : null} />;
}
