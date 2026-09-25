import { formatCadence } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RANGE } from "@/features/range/copy";
import { usdBand } from "@/features/range/format";
import { useGames } from "~/features/games/shell";
import { FONT } from "~/theme";
import { useRangeTokens } from "./PageParts";
import { Clock } from "./TicketParts";

interface Props {
  windows: EventMarket[];
  loading: boolean;
  pickedId: MarketId | null;
  nowMs: number;
  onPick: (id: MarketId) => void;
}

/**
 * web's `range/WindowPicker.tsx`: the Windows a reserve round may sit on as the parlay's menu rows (`.pl-menu-item`,
 * laid flat in the plate as `.rg-windows`) — loading, none (and why), or the list. Shared by Range and Moonshot.
 */
export function WindowPicker({ windows, loading, pickedId, nowMs, onPick }: Props) {
  const { r, color } = useRangeTokens();
  const { feedback } = useGames();
  const { builder } = RANGE;
  if (loading && windows.length === 0) return <Text style={[styles.loading, { color: color.inkDisabled }]}>{builder.loading}</Text>;
  if (windows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: color.inkSecondary }]}>{builder.noWindows}</Text>
        <Text style={[styles.emptyBody, { color: color.inkDisabled }]}>{builder.noWindowsBody}</Text>
      </View>
    );
  }
  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={builder.pickWindow}>
      {windows.map((market) => {
        const on = market.marketId === pickedId;
        const label = `${market.asset} ${formatCadence(market.intervalSec)} · ${market.openingPriceRaw !== null ? `${builder.opening} ${usdBand(market.openingPriceRaw)}` : builder.openingPending}`;
        return (
          <Pressable
            key={market.marketId}
            onPress={() => {
              if (on) return;
              feedback("tap");
              onPick(market.marketId);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.item, (on || pressed) && { backgroundColor: on ? r.menuOn : r.pillBg }]}
          >
            <Text style={[styles.itemText, { color: on ? color.ink : color.inkSecondary }]} numberOfLines={2}>
              {label}
            </Text>
            <Clock expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} style={[styles.when, { color: color.inkMuted }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 48, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4 },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyTitle: { marginBottom: 4, fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4, textAlign: "center" },
  emptyBody: { marginBottom: 16, maxWidth: 240, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.5, textAlign: "center" },
  list: { gap: 4, marginBottom: 12 },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8, paddingHorizontal: 12 },
  itemText: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18 },
  when: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
});
