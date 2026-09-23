import { isTickerSymbol } from "@agari/core/market";
import type { MarketId } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import { useState } from "react";
import { View } from "react-native";
import { ROOM } from "@/features/room/copy";
import { tickerRoomId } from "@/features/room/room-id";
import type { RoomScope } from "@/features/room/RoomSwitch";
import { Segmented } from "~/components/kit";
import { RoomSheet } from "./RoomSheet";

interface MarketRoomSheetProps {
  visible: boolean;
  marketId: MarketId;
  /** The call this Room is about, e.g. "TSLA holds above $359.07? · 5m". */
  callLabel: string;
  onClose: () => void;
  onBet?: () => void;
  /** The Window's ticker when the caller already has it; otherwise read from the index. */
  asset?: string;
}

/**
 * web's `MarketRoom` (features/room/MarketRoom.tsx): a Window's Room, with its ticker's standing Room one tap away in
 * the head ("This Window · $TSLA"). For the Window screen and the reel to mount; the ticker comes from the caller or
 * the Window's index row, so no chain read is added.
 */
export function MarketRoomSheet({ visible, marketId, callLabel, onClose, onBet, asset }: MarketRoomSheetProps) {
  const market = useMarket(asset === undefined && visible ? marketId : null);
  const symbol = asset ?? (market?.ok ? market.value?.asset : undefined);
  const ticker = isTickerSymbol(symbol) ? symbol : null;
  const [scope, setScope] = useState<RoomScope>("window");
  const inTicker = scope === "ticker" && ticker !== null;
  const switcher = ticker ? (
    <View style={{ marginTop: 6 }}>
      <Segmented
        label={ROOM.ticker.switchLabel}
        value={scope}
        onChange={setScope}
        options={[
          { value: "window", label: ROOM.ticker.window },
          { value: "ticker", label: ROOM.ticker.room(ticker) },
        ]}
      />
    </View>
  ) : null;
  return (
    <RoomSheet
      visible={visible}
      roomId={inTicker ? tickerRoomId(ticker) : marketId}
      callLabel={inTicker ? ROOM.ticker.title(ticker) : callLabel}
      ticker={inTicker ? ticker : null}
      onClose={onClose}
      onBet={onBet}
      switcher={switcher}
    />
  );
}
