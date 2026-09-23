import { SETTLING } from "@agari/core/copy";
import { countdown } from "@agari/core/lifecycle";
import { formatCadence } from "@agari/core/market";
import type { EventMarket, MarketId } from "@agari/core/types";
import { formatClock } from "@agari/core/units";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RANGE } from "@/features/range/copy";
import { usdBand } from "@/features/range/format";
import { EmptyState, haptic, LoadingState } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** web's `components/data/Countdown.tsx`: the chain-corrected clock to a Window's close, "settling" at zero. */
export function Clock({ expirySec, intervalSec, nowMs, style }: { expirySec: number; intervalSec: number; nowMs: number; style?: object }) {
  const { color } = useTheme();
  const state = nowMs > 0 ? countdown(nowMs, expirySec, intervalSec) : null;
  const text = state ? (state.settling ? SETTLING : formatClock(state.remainingSec)) : "–:––";
  return (
    <Text style={[TYPE.data, { color: state?.urgent ? color.accent : color.inkSecondary }, style]} accessibilityRole="timer">
      {text}
    </Text>
  );
}

interface Props {
  windows: EventMarket[];
  loading: boolean;
  pickedId: MarketId | null;
  nowMs: number;
  onPick: (id: MarketId) => void;
}

/**
 * web's `range/WindowPicker.tsx` — the Windows a reserve round may sit on (Trading, a minute or more left, soonest
 * first) as touch rows with the stock's disc: loading, none (and why), or the list. Shared by Range and Moonshot.
 */
export function WindowPicker({ windows, loading, pickedId, nowMs, onPick }: Props) {
  const { color } = useTheme();
  const { builder } = RANGE;
  if (loading && windows.length === 0) return <LoadingState shape="list" label={builder.loading} />;
  if (windows.length === 0) return <EmptyState why={builder.noWindows} detail={builder.noWindowsBody} />;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={builder.pickWindow} style={styles.list}>
      {windows.map((market) => {
        const on = market.marketId === pickedId;
        const opening = market.openingPriceRaw !== null ? `${builder.opening} ${usdBand(market.openingPriceRaw)}` : builder.openingPending;
        return (
          <Pressable
            key={market.marketId}
            onPress={() => {
              if (on) return;
              haptic.select();
              onPick(market.marketId);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${market.asset} ${formatCadence(market.intervalSec)}, ${opening}`}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline },
              pressed && { opacity: 0.85 },
            ]}
          >
            <AssetDisc asset={market.asset} size={28} />
            <View style={styles.main}>
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
                {market.asset} <Text style={{ color: color.inkMuted }}>{formatCadence(market.intervalSec)}</Text>
              </Text>
              <Text style={[TYPE.caption, { color: color.inkSecondary }]} numberOfLines={1}>
                {opening}
              </Text>
            </View>
            <Clock expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1 },
  main: { flex: 1, gap: 1 },
});
