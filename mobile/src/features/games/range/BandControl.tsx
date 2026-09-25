import type { RangeSide } from "@agari/core/range";
import { Minus, Plus, RotateCcw, type LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RANGE } from "@/features/range/copy";
import { printToUsd, usdOnGrid } from "@/features/range/format";
import { bandHalfUsd, RANGE_PRESETS } from "@/features/range/presets";
import type { RangeDraft } from "@/features/range/useRangeDraft";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { BandTrack } from "./BandTrack";
import { useRangeTokens } from "./PageParts";

interface Props {
  asset: string;
  intervalSec: number;
  draft: RangeDraft;
  side: RangeSide;
  /** The reference's Ticket has inside only; the game page offers both. */
  onSide?: (side: RangeSide) => void;
  /** D-119: the live spot, so the band can say when it does not cover it. */
  spot: bigint | null;
  onDragging: (dragging: boolean) => void;
}

/**
 * web's `range/BandControl.tsx` (range-band.css): the explicit bounds, the draggable band on a track with the spot
 * marked, three width presets scaled per cadence, centre steps on the asset's grid, and inside/outside. When the
 * band no longer covers the live price it says so (D-119).
 */
export function BandControl({ asset, intervalSec, draft, side, onSide, spot, onDragging }: Props) {
  const { r, color } = useRangeTokens();
  const { band } = RANGE;
  const { spotUsd, lowUsd, highUsd, offset, unit, decimals } = draft;
  const ready = spotUsd !== null && lowUsd !== null && highUsd !== null;
  const usd = (n: number) => usdOnGrid(n, decimals);
  const spotOnGrid = spot === null ? null : printToUsd(spot);
  const marketUsd = spotOnGrid ?? spotUsd;
  const outsideBand = ready && spotOnGrid !== null && (spotOnGrid < lowUsd || spotOnGrid > highUsd);
  const step = usd(unit);
  const k = [styles.k, { color: r.k }];

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.label, { color: r.bandLabel }]}>{band.label.toUpperCase()}</Text>
        <Text style={[styles.must, { color: r.bandMust }]}>{band.mustFinish(asset, side)}</Text>
      </View>

      <View style={[styles.card, { borderColor: r.bandBorder, backgroundColor: r.bandBg }]} accessibilityLiveRegion="polite">
        {ready && marketUsd !== null ? (
          <>
            <View style={styles.bounds}>
              <View style={styles.bound}>
                <Text style={k}>{band.from.toUpperCase()}</Text>
                <Text style={[styles.v, { color: color.accent }]}>{usd(lowUsd)}</Text>
              </View>
              <Text style={[styles.arrow, { color: r.arrow }]}>→</Text>
              <View style={[styles.bound, styles.right]}>
                <Text style={k}>{band.to.toUpperCase()}</Text>
                <Text style={[styles.v, { color: color.accent }]}>{usd(highUsd)}</Text>
              </View>
            </View>
            <BandTrack asset={asset} draft={draft} marketUsd={marketUsd} onDragging={onDragging} />
            <View style={[styles.foot, { borderTopColor: r.footRule }]}>
              <Text style={[styles.footText, { color: r.footInk }]}>{band.now(asset)}</Text>
              <Text style={[styles.footText, styles.numbers, { color: r.footV }]}>{usd(marketUsd)}</Text>
            </View>
          </>
        ) : (
          <View style={styles.wait}>
            <Text style={[styles.waitText, { color: r.wait }]}>{band.waiting}</Text>
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
              style={({ pressed }) => [
                styles.preset,
                { borderColor: on ? r.presetOnBorder : r.presetBorder, backgroundColor: on ? r.presetOnBg : "transparent" },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.presetName, { color: on ? color.ink : r.presetInk }]}>{band.presetLabel(p.key, p.label)}</Text>
              <Text style={[styles.presetSpan, { color: on ? color.accent : r.presetSpan }]}>{band.span(usd(bandHalfUsd(p.key, intervalSec, spotUsd) * 2))}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.center, { borderTopColor: r.centerRule }]}>
        <View style={styles.centerText}>
          <Text style={k}>{band.center.toUpperCase()}</Text>
          <Text style={[styles.centerV, { color: r.centerV }]} numberOfLines={1}>
            {offset === 0 ? band.atMarket : band.offMarket(usd(Math.abs(offset)), offset > 0)}
          </Text>
        </View>
        <View style={styles.btns}>
          <IconBtn Icon={Minus} label={band.lower(step)} onPress={() => draft.nudge(-1)} />
          <IconBtn Icon={RotateCcw} label={band.recenter} disabled={offset === 0} onPress={draft.recenter} />
          <IconBtn Icon={Plus} label={band.higher(step)} onPress={() => draft.nudge(1)} />
        </View>
      </View>

      {outsideBand && spotOnGrid !== null ? <Text style={[styles.note, { color: color.accent }]}>{band.spotOutside(usd(spotOnGrid))}</Text> : null}

      {onSide ? (
        <View style={[styles.sides, { borderColor: r.sidesBorder, backgroundColor: r.sidesBg }]} accessibilityRole="radiogroup" accessibilityLabel={band.sideLabel}>
          {(["inside", "outside"] as const).map((option) => {
            const on = side === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  haptic.select();
                  onSide(option);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.side, on && { backgroundColor: r.sideOnBg }]}
              >
                <Text style={[styles.sideText, { color: on ? color.accent : r.sideInk }]}>{(option === "inside" ? band.inside : band.outside).toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** range-band.css `.rg-icon-btn`: a 32 px square, a 14 px lucide glyph, a quarter opacity when disabled. */
export function IconBtn({ Icon, label, onPress, disabled }: { Icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean }) {
  const { r } = useRangeTokens();
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
      style={({ pressed }) => [styles.icon, { borderColor: r.iconBorder }, disabled && styles.iconOff, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <Icon size={14} color={r.iconInk} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 8 },
  label: { fontFamily: FONT.dataRegular, fontSize: 9, letterSpacing: 1.44 },
  must: { flexShrink: 1, textAlign: "right", fontFamily: FONT.dataRegular, fontSize: 8.5 },
  card: { borderRadius: 6, borderWidth: 1, overflow: "hidden" },
  bounds: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 10, paddingHorizontal: 12 },
  bound: { flex: 1 },
  right: { alignItems: "flex-end" },
  k: { fontFamily: FONT.dataRegular, fontSize: 7.5, letterSpacing: 1.05 },
  v: { marginTop: 2, fontFamily: FONT.data, fontSize: 13, lineHeight: 18, fontVariant: ["tabular-nums"] },
  arrow: { fontFamily: FONT.dataRegular, fontSize: 10 },
  numbers: { fontVariant: ["tabular-nums"] },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingVertical: 6, paddingHorizontal: 12 },
  footText: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12 },
  wait: { height: 84, alignItems: "center", justifyContent: "center" },
  waitText: { fontFamily: FONT.dataRegular, fontSize: 9 },
  presets: { marginTop: 8, flexDirection: "row", gap: 4 },
  preset: { flex: 1, borderRadius: 4, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 8 },
  pressed: { transform: [{ scale: 0.98 }] },
  presetName: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 11 },
  presetSpan: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 7.5, fontVariant: ["tabular-nums"] },
  center: { marginTop: 8, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, paddingTop: 8 },
  centerText: { flex: 1, minWidth: 0 },
  centerV: { marginTop: 2, fontFamily: FONT.dataRegular, fontSize: 9, fontVariant: ["tabular-nums"] },
  btns: { flexDirection: "row", alignItems: "center", gap: 4 },
  icon: { width: 32, height: 32, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  iconOff: { opacity: 0.25 },
  note: { marginTop: 10, fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
  sides: { marginTop: 8, flexDirection: "row", gap: 4, borderRadius: 6, borderWidth: 1, padding: 4 },
  side: { flex: 1, paddingVertical: 8, borderRadius: 4, alignItems: "center" },
  sideText: { fontFamily: FONT.dataRegular, fontSize: 10, letterSpacing: 1.4 },
});
