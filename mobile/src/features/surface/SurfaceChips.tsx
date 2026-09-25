import { formatCadence, type TickerSymbol } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { formatClock, remainingSec } from "@agari/core/units";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SURFACE } from "@/features/surface/copy";
import { useTheme } from "~/theme";
import { surfaceTokens } from "~/theme/web/explore/surface";
import { MONO } from "./parts";

interface Props {
  assets: readonly TickerSymbol[];
  asset: TickerSymbol | null;
  onAsset: (asset: TickerSymbol) => void;
  windows: readonly EventMarket[];
  focalId: MarketId | null;
  onFocal: (marketId: MarketId) => void;
  nowMs: number;
}

/** web's SurfaceChips: the asset pills, a grey dot, then one chip per live Window of the asset with its clock. */
export function SurfaceChips({ assets, asset, onAsset, windows, focalId, onFocal, nowMs }: Props) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  return (
    <View style={styles.chips}>
      <View style={styles.group} accessibilityLabel={SURFACE.chips.assets}>
        {assets.map((a) => {
          const on = asset === a;
          return (
            <Pressable
              key={a}
              onPress={() => onAsset(a)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.asset, { borderColor: on ? t.chipOnBorder : t.chipBorder, backgroundColor: on ? t.chipOnFill : undefined }]}
            >
              <Text style={[styles.assetText, { color: on ? color.ink : color.inkMuted }]}>{a}</Text>
            </Pressable>
          );
        })}
      </View>
      {windows.length > 1 ? (
        <>
          <Text style={[styles.sep, { color: t.gray700 }]}>·</Text>
          <View style={styles.group} accessibilityLabel={SURFACE.chips.windows}>
            {windows.map((market) => {
              const on = focalId === market.marketId;
              const left = nowMs > 0 ? remainingSec(nowMs, market.expirySec) : 0;
              return (
                <WindowChip key={market.marketId} on={on} onPress={() => onFocal(market.marketId)} label={formatCadence(market.intervalSec)} clock={left > 0 ? formatClock(left) : "—"} />
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** `.sf-chip--window`: the square chip, vermilion when on; the ladder's side toggle uses it too. */
export function WindowChip({ on, onPress, label, clock }: { on: boolean; onPress: () => void; label: string; clock?: string }) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const ink = on ? color.accent : color.inkMuted;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.window, { borderColor: on ? t.windowOnBorder : t.chipBorder }]}>
      <Text style={[styles.windowText, { color: ink }]}>{label}</Text>
      {clock !== undefined ? <Text style={[styles.windowText, styles.clock, on ? { color: ink, opacity: 0.7 } : { color: color.inkDisabled }]}>{clock}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 32 },
  group: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  asset: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9999, borderWidth: 1 },
  assetText: { fontFamily: MONO, fontSize: 12, lineHeight: 19.2 },
  sep: { fontFamily: MONO, fontSize: 15, lineHeight: 24, marginHorizontal: 4 },
  window: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1 },
  windowText: { fontFamily: MONO, fontSize: 11, lineHeight: 17.6 },
  clock: { fontVariant: ["tabular-nums"] },
});
