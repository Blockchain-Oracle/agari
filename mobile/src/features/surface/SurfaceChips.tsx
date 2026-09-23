import { formatCadence, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SURFACE } from "@/features/surface/copy";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { clockText } from "./parts";

function Chip({ on, onPress, label, children }: { on: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (on) return;
        haptic.select();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={[styles.chip, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
    >
      {children}
    </Pressable>
  );
}

/**
 * web's `SurfaceChips` (features/surface/SurfaceChips.tsx): the live assets, soonest close first, then one chip per live
 * Window of the chosen asset with its cadence and clock. Two swipeable rows on a phone.
 */
export function SurfaceChips({ assets, asset, onAsset, windows, focalId, onFocal, nowMs }: {
  assets: readonly TickerSymbol[];
  asset: TickerSymbol | null;
  onAsset: (asset: TickerSymbol) => void;
  windows: readonly EventMarket[];
  focalId: MarketId | null;
  onFocal: (marketId: MarketId) => void;
  nowMs: number;
}) {
  const { color } = useTheme();
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel={SURFACE.chips.assets}>
        {assets.map((a) => (
          <Chip key={a} on={asset === a} onPress={() => onAsset(a)} label={a}>
            <AssetDisc asset={a} size={20} />
            <Text style={[TYPE.data, { color: asset === a ? color.accent : color.ink }]}>{a}</Text>
          </Chip>
        ))}
      </ScrollView>
      {windows.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel={SURFACE.chips.windows}>
          {windows.map((market) => {
            const on = focalId === market.marketId;
            const clock = clockText(market.expirySec, nowMs);
            return (
              <Chip key={market.marketId} on={on} onPress={() => onFocal(market.marketId)} label={`${formatCadence(market.intervalSec)} Window, closes in ${clock}`}>
                <Text style={[styles.cadence, { color: on ? color.accent : color.ink }]}>{formatCadence(market.intervalSec)}</Text>
                <Text style={[styles.clock, { color: color.inkMuted }]}>{clock}</Text>
              </Chip>
            );
          })}
        </ScrollView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS.full, borderWidth: 1 },
  cadence: { fontFamily: FONT.dataStrong, fontSize: 13 },
  clock: { fontFamily: FONT.data, fontSize: 12 },
});
