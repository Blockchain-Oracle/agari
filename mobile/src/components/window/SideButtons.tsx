import type { Side } from "@agari/core/types";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { sidesInOrder, useBetAgainst } from "@/features/markets/bet-against";
import { HERO_HEAD, MARKETS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";

interface Props {
  upCents: number | null;
  downCents: number | null;
  onPick: (side: Side) => void;
  disabled?: boolean;
  /** "…" while the first book read is in flight, rather than a price not yet known. */
  hydrating?: boolean;
  height?: number;
}

/**
 * web's HeroYesNo: the Window's two calls at the book's live best asks, in cents. DOWN comes first while "Betting
 * against" is on (A-1a). An empty side reads "—", never a filled-in price.
 */
export function SideButtons({ upCents, downCents, onPick, disabled, hydrating = false, height = 64 }: Props) {
  const { color } = useTheme();
  const betAgainst = useBetAgainst();
  const price = (cents: number | null) => (cents === null ? (hydrating ? "…" : HERO_HEAD.noPrice) : `${cents}¢`);
  return (
    <View style={styles.row}>
      {sidesInOrder(betAgainst).map((side) => {
        const up = side === "up";
        const ink = up ? color.profit : color.loss;
        const cents = up ? upCents : downCents;
        return (
          <Pressable
            key={side}
            disabled={disabled}
            onPress={() => {
              haptic.tap();
              onPick(side);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${up ? HERO_HEAD.betUp : HERO_HEAD.betDown}${cents === null ? "" : `, ${cents} cents`}`}
            accessibilityState={{ disabled: !!disabled }}
            style={({ pressed }) => [
              styles.side,
              { height, backgroundColor: up ? color.profitWash : color.lossWash, borderColor: ink, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
            ]}
          >
            <View style={styles.label}>
              {up ? <ArrowUp size={17} color={ink} strokeWidth={2.25} /> : <ArrowDown size={17} color={ink} strokeWidth={2.25} />}
              <Text style={[styles.word, height < 56 && styles.small, { color: ink }]}>{up ? MARKETS.up : MARKETS.down}</Text>
            </View>
            <Text style={[styles.price, height < 56 && styles.small, { color: ink }]}>{price(cents)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  side: { flex: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 14 },
  label: { flexDirection: "row", alignItems: "center", gap: 6 },
  word: { fontFamily: FONT.headingHeavy, fontSize: 19 },
  small: { fontSize: 16 },
  price: { fontFamily: FONT.dataStrong, fontSize: 19, fontVariant: ["tabular-nums"] },
});
