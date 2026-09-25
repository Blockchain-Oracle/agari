import type { TickerSymbol } from "@agari/core/market";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ROOM } from "@/features/room/copy";
import type { RoomScope } from "@/features/room/RoomSwitch";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { ROOM_VERMILION as V, roomTokens } from "~/theme/web/explore/room";

/**
 * web's `RoomSwitch` (room-switch.css): the head's two Rooms — this Window's thread, or the ticker's standing one
 * (`$TSLA`) — as two segments in the badge's own pill, on its own line under the badge at phone width.
 */
export function RoomSwitch({ symbol, scope, onScope }: { symbol: TickerSymbol; scope: RoomScope; onScope: (scope: RoomScope) => void }) {
  const { name, color } = useTheme();
  const t = roomTokens(name);
  const segments: [RoomScope, string][] = [
    ["window", ROOM.ticker.window],
    ["ticker", ROOM.ticker.room(symbol)],
  ];
  return (
    <View style={[styles.switch, { borderColor: t.rule, backgroundColor: t.inset }]} accessibilityRole="radiogroup" accessibilityLabel={ROOM.ticker.switchLabel}>
      {segments.map(([value, label]) => {
        const on = scope === value;
        return (
          <Pressable
            key={value}
            onPress={() => {
              haptic.select();
              onScope(value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.segment, on && { backgroundColor: V.switchOn }]}
          >
            <Text style={[styles.label, { color: on ? color.accent : t.ink45 }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 6, borderWidth: 1, borderRadius: 999, padding: 1 },
  segment: { borderRadius: 999, paddingVertical: 1, paddingHorizontal: 8 },
  label: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14, letterSpacing: 1.08, textTransform: "uppercase" },
});
