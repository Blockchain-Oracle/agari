import type { TickerSymbol } from "@agari/core/market";
import { router } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { ROOM } from "@/features/room/copy";
import { tickerRoomId } from "@/features/room/room-id";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { roomTokens } from "~/theme/web/explore/room";
import { RoomSheet } from "./RoomSheet";

/**
 * web's `TickerRoomButton` (features/room/TickerRoom.tsx): the ticker's standing Room (`$TSLA`), drawn as the hero
 * foot's Room control (`.mh-room`: mono caps, the chat icon, "bettors only" a step quieter). "Place a bet" leaves the
 * sheet for the markets.
 */
export function TickerRoomButton({ symbol }: { symbol: TickerSymbol }) {
  const { name } = useTheme();
  const t = roomTokens(name);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => {
          haptic.tap();
          setOpen(true);
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`${ROOM.ticker.open(symbol)}, ${ROOM.qualifier}`}
        style={styles.button}
      >
        <MessageCircle size={12} color={t.triggerInk} />
        <Text style={[styles.label, { color: t.triggerInk }]}>
          {ROOM.ticker.open(symbol)} <Text style={{ color: t.triggerMeta }}>{ROOM.qualifier}</Text>
        </Text>
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
  button: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6 },
  label: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
});
