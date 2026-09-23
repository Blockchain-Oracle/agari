import type { Side } from "@agari/core/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { sidesInOrder, useBetAgainst } from "@/features/markets/bet-against";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { TICKET } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";

/**
 * web's SideSegments: tap-is-the-choice, the chosen side in its own ink and wash; DOWN first while "Betting against"
 * is on (A-1a).
 */
export function SideToggle({ side, onSelect }: { side: Side | null; onSelect: (side: Side) => void }) {
  const { color } = useTheme();
  const betAgainst = useBetAgainst();
  return (
    <View style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityRole="radiogroup" accessibilityLabel={TICKET.sideLabel}>
      {sidesInOrder(betAgainst).map((value) => {
        const on = side === value;
        const ink = value === "up" ? color.profit : color.loss;
        const wash = value === "up" ? color.profitWash : color.lossWash;
        return (
          <Pressable
            key={value}
            onPress={() => {
              haptic.select();
              onSelect(value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.seg, { backgroundColor: on ? wash : "transparent", borderColor: on ? ink : "transparent" }]}
          >
            <Text style={[styles.label, { color: on ? ink : color.inkMuted }]}>{SIDE_WORD[value]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", padding: 4, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  seg: { flex: 1, height: 44, borderRadius: RADIUS.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: FONT.headingHeavy, fontSize: 16 },
});
