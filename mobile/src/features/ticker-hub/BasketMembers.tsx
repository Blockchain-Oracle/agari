import { TICKERS, type Basket } from "@agari/core/market";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usdLine } from "@/features/markets/hero/units";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import type { BasketMemberView } from "@/features/ticker-hub/usePreIpoFacts";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, TYPE, useTheme } from "~/theme";

const signedPct = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;

interface BasketMembersProps {
  basket: Basket;
  members: readonly BasketMemberView[] | null;
  held: ReadonlySet<string> | null;
}

/**
 * web's `BasketMembers` table, one row per company for a phone: the mark, the name and its cashtag (a link to its own
 * hub), then weight · token price · since base · you hold as a mono line. Weights show before the feed answers.
 */
export function BasketMembers({ basket, members, held }: BasketMembersProps) {
  const { color } = useTheme();
  const T = TICKER_HUB.basket.table;
  return (
    <View>
      {basket.members.map((m) => {
        const row = members?.find((r) => r.symbol === m.symbol) ?? null;
        const move = row?.moveBps ?? null;
        const holds = held?.has(m.symbol) ?? null;
        const weight = `${(m.weightBps / 100).toFixed(m.weightBps % 100 === 0 ? 0 : 1)}%`;
        const moveInk = move === null || move === 0 ? color.inkSecondary : move > 0 ? color.profit : color.loss;
        return (
          <Pressable
            key={m.symbol}
            onPress={() => {
              haptic.tap();
              router.push(`/tickers/${m.symbol}`);
            }}
            accessibilityRole="link"
            accessibilityLabel={`${TICKERS[m.symbol].name}, ${T.weight} ${weight}`}
            style={({ pressed }) => [styles.row, { borderBottomColor: color.hairline, backgroundColor: pressed ? color.surface2 : "transparent" }]}
          >
            <AssetDisc asset={m.symbol} size={34} />
            <View style={styles.text}>
              <View style={styles.nameRow}>
                <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>
                  {TICKERS[m.symbol].name}
                </Text>
                <Text style={[styles.tag, { color: color.accent }]}>${m.symbol}</Text>
              </View>
              <View style={styles.cells}>
                <Cell label={T.weight} value={weight} />
                <Cell label={T.price} value={row ? usdLine(row.tokenPriceE8) : TICKER_HUB.dash} />
                <Cell label={T.sinceBase} value={move === null ? TICKER_HUB.dash : signedPct(move)} ink={moveInk} />
                <Cell label={T.held} value={holds === null ? TICKER_HUB.dash : holds ? T.yes : T.no} ink={holds ? color.accent : undefined} />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Cell({ label, value, ink }: { label: string; value: string; ink?: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.data, { color: ink ?? color.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  tag: { fontFamily: FONT.dataStrong, fontSize: 12 },
  cells: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 },
  cell: { gap: 1 },
  cellLabel: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },
});
