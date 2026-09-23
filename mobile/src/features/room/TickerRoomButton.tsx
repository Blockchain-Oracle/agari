import type { TickerSymbol } from "@agari/core/market";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { ROOM } from "@/features/room/copy";
import { tickerRoomId } from "@/features/room/room-id";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";
import { RoomMark } from "./RoomStates";
import { RoomSheet } from "./RoomSheet";

/**
 * web's `TickerRoomButton` (features/room/TickerRoom.tsx): the ticker's standing Room (`$TSLA`), in the hero foot's
 * mono-caps grammar with "bettors only" a step quieter. "Place a bet" leaves the sheet for the Markets tab.
 */
export function TickerRoomButton({ symbol }: { symbol: TickerSymbol }) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => {
          haptic.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${ROOM.ticker.open(symbol)}, ${ROOM.qualifier}`}
        style={({ pressed }) => [
          styles.button,
          { borderColor: color.borderStrong, backgroundColor: pressed ? color.surface2 : color.surface1 },
        ]}
      >
        <RoomMark size={18} tint={color.accent} />
        <Text style={[styles.label, { color: color.ink }]}>{ROOM.ticker.open(symbol)}</Text>
        <Text style={[styles.meta, { color: color.inkMuted }]}>{ROOM.qualifier}</Text>
      </Pressable>
      <RoomSheet
        visible={open}
        roomId={tickerRoomId(symbol)}
        callLabel={ROOM.ticker.title(symbol)}
        ticker={symbol}
        onClose={() => setOpen(false)}
        onBet={() => {
          setOpen(false);
          router.push("/markets");
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1 },
  label: { fontFamily: FONT.dataStrong, fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase" },
  meta: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 0.4 },
});
