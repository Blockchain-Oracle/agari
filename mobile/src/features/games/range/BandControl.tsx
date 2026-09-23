import type { RangeSide } from "@agari/core/range";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RANGE } from "@/features/range/copy";
import { printToUsd, usdOnGrid } from "@/features/range/format";
import { bandHalfUsd, RANGE_PRESETS } from "@/features/range/presets";
import type { RangeDraft } from "@/features/range/useRangeDraft";
import { haptic, Segmented, Skeleton } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { BandTrack } from "./BandTrack";

interface Props {
  asset: string;
  intervalSec: number;
  draft: RangeDraft;
  side: RangeSide;
  onSide: (side: RangeSide) => void;
  /** The live spot, so the band can say when it does not cover it. */
  spot: bigint | null;
  onDragging: (dragging: boolean) => void;
}

/**
 * web's `range/BandControl.tsx`: the explicit bounds, the draggable band on a price axis with the live price marked,
 * three width presets scaled per cadence, centre steps on the asset's grid, and inside/outside. When the band no
 * longer covers the live price, it says so instead of quoting in silence (D-119).
 */
export function BandControl({ asset, intervalSec, draft, side, onSide, spot, onDragging }: Props) {
  const { color } = useTheme();
  const { band } = RANGE;
  const { spotUsd, lowUsd, highUsd, offset, unit, decimals } = draft;
  const ready = spotUsd !== null && lowUsd !== null && highUsd !== null;
  const usd = (n: number) => usdOnGrid(n, decimals);
  const spotOnGrid = spot === null ? null : printToUsd(spot);
  const marketUsd = spotOnGrid ?? spotUsd;
  const outsideBand = ready && spotOnGrid !== null && (spotOnGrid < lowUsd || spotOnGrid > highUsd);
  const step = usd(unit);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{band.label}</Text>
        <Text style={[TYPE.caption, { color: side === "inside" ? color.profit : color.warning }]}>{band.mustFinish(asset, side)}</Text>
      </View>

      <View style={[styles.card, { backgroundColor: color.surface2, borderColor: color.hairline }]} accessibilityLiveRegion="polite">
        {ready && marketUsd !== null ? (
          <>
            <View style={styles.bounds}>
              <View>
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>{band.from}</Text>
                <Text style={[TYPE.dataLg, { color: color.ink }]}>{usd(lowUsd)}</Text>
              </View>
              <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={16} tintColor={color.inkMuted} />
              <View style={styles.boundRight}>
                <Text style={[TYPE.caption, { color: color.inkMuted }]}>{band.to}</Text>
                <Text style={[TYPE.dataLg, { color: color.ink }]}>{usd(highUsd)}</Text>
              </View>
            </View>
            <BandTrack asset={asset} intervalSec={intervalSec} draft={draft} marketUsd={marketUsd} onDragging={onDragging} />
            <View style={styles.foot}>
              <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{band.now(asset)}</Text>
              <Text style={[TYPE.data, { color: color.ink }]}>{usd(marketUsd)}</Text>
            </View>
          </>
        ) : (
          <View style={styles.wait}>
            <Skeleton height={20} width="60%" />
            <Skeleton height={40} />
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{band.waiting}</Text>
          </View>
        )}
      </View>

      <View style={styles.presets} accessibilityLabel={band.width}>
        {RANGE_PRESETS.map((p) => {
          const on = draft.preset === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => {
                haptic.select();
                draft.setPreset(p.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.preset, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
            >
              <Text style={[TYPE.bodyStrong, { color: on ? color.accent : color.ink }]}>{band.presetLabel(p.key, p.label)}</Text>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>{band.span(usd(bandHalfUsd(p.key, intervalSec, spotUsd) * 2))}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.center}>
        <View style={styles.centerText}>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{band.center}</Text>
          <Text style={[TYPE.data, { color: color.ink }]}>{offset === 0 ? band.atMarket : band.offMarket(usd(Math.abs(offset)), offset > 0)}</Text>
        </View>
        <IconButton icon={{ ios: "minus", android: "remove" }} label={band.lower(step)} onPress={() => draft.nudge(-1)} />
        <IconButton icon={{ ios: "arrow.counterclockwise", android: "restart_alt" }} label={band.recenter} disabled={offset === 0} onPress={draft.recenter} />
        <IconButton icon={{ ios: "plus", android: "add" }} label={band.higher(step)} onPress={() => draft.nudge(1)} />
      </View>

      {outsideBand && spotOnGrid !== null ? <Text style={[TYPE.caption, { color: color.warning }]}>{band.spotOutside(usd(spotOnGrid))}</Text> : null}

      <Segmented
        label={band.sideLabel}
        value={side}
        onChange={onSide}
        options={[
          { value: "inside", label: band.inside },
          { value: "outside", label: band.outside },
        ]}
      />
    </View>
  );
}

function IconButton({ icon, label, onPress, disabled }: { icon: SymbolViewProps["name"]; label: string; onPress: () => void; disabled?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.icon, { borderColor: color.hairline, backgroundColor: pressed ? color.surface2 : color.surface1, opacity: disabled ? 0.4 : 1 }]}
    >
      <SymbolView name={icon} size={16} tintColor={color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  head: { gap: 2 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  bounds: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  boundRight: { alignItems: "flex-end" },
  foot: { flexDirection: "row", justifyContent: "space-between" },
  wait: { gap: 10 },
  presets: { flexDirection: "row", gap: 8 },
  preset: { flex: 1, minHeight: 56, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  center: { flexDirection: "row", alignItems: "center", gap: 8 },
  centerText: { flex: 1, gap: 2 },
  icon: { width: 44, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
