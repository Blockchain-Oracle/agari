import { formatCadence } from "@agari/core/copy";
import type { EventMarket, Side } from "@agari/core/types";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { TAKES } from "@/features/takes/copy";
import type { ComposerHorizon } from "@/features/takes/useComposerMarket";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const C = TAKES.composer;
/** web's side words carry a leading glyph ("▲ Up"); the app draws the arrow as a symbol instead. */
const bare = (label: string) => label.replace(/^\S+\s/, "");

interface SideOption {
  key: Side | "range";
  label: string;
  icon: SymbolViewProps["name"];
}

const SIDES: readonly SideOption[] = [
  { key: "up", label: bare(C.up), icon: { ios: "arrow.up", android: "arrow_upward" } },
  { key: "down", label: bare(C.down), icon: { ios: "arrow.down", android: "arrow_downward" } },
  { key: "range", label: bare(C.range), icon: { ios: "square.3.layers.3d", android: "layers" } },
];

/** web's `.take-sides`: Up, Down, and Range present but disabled, naming what it waits on. */
export function SidePicker({ side, onSide }: { side: Side; onSide: (side: Side) => void }) {
  const { color } = useTheme();
  return (
    <View style={styles.sides}>
      {SIDES.map((option) => {
        const disabled = option.key === "range";
        const on = option.key === side;
        const ink = option.key === "up" ? color.profit : option.key === "down" ? color.loss : color.inkDisabled;
        return (
          <Pressable
            key={option.key}
            disabled={disabled}
            onPress={() => {
              haptic.select();
              onSide(option.key as Side);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            accessibilityLabel={disabled ? `${option.label} — ${C.rangePending}` : option.label}
            style={[
              styles.side,
              {
                borderColor: on ? ink : color.hairline,
                backgroundColor: on ? (option.key === "up" ? color.profitWash : color.lossWash) : color.surface1,
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <SymbolView name={option.icon} size={15} tintColor={on ? ink : color.inkSecondary} />
            <Text style={[styles.sideText, { color: on ? ink : color.inkSecondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** web's `.take-horizon`: the live lanes' cadences; a cadence with no enterable Window is disabled. */
export function HorizonRow({ horizon }: { horizon: ComposerHorizon }) {
  const { color } = useTheme();
  return (
    <View style={styles.horizon}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{C.horizon}</Text>
      {horizon.lanes.length === 0 ? (
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{C.noWindows}</Text>
      ) : (
        <View style={styles.grid}>
          {horizon.lanes.map((lane) => {
            const live = horizon.hasLive(lane.intervalSec);
            const on = horizon.intervalSec === lane.intervalSec;
            return (
              <Pressable
                key={`${lane.basis}:${lane.intervalSec}`}
                disabled={!live}
                onPress={() => {
                  haptic.select();
                  horizon.setIntervalSec(lane.intervalSec);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !live }}
                style={[
                  styles.cadence,
                  { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : color.surface1, opacity: live ? 1 : 0.45 },
                ]}
              >
                <Text style={[TYPE.data, { color: on ? color.accent : color.ink }]}>{formatCadence(lane.intervalSec)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** web's `.take-preview`: the card's call chip, mirrored — mark, direction, cashtag, the band's words, the Window. */
export function TakePreview({ market, side, lineRaw }: { market: EventMarket | null; side: Side; lineRaw: bigint | null }) {
  const { color } = useTheme();
  const band =
    market === null
      ? null
      : lineRaw === null
        ? TAKES.noLine(market.asset)
        : side === "up"
          ? TAKES.over(market.asset, assetPriceLine(market.asset, lineRaw))
          : TAKES.under(market.asset, assetPriceLine(market.asset, lineRaw));
  const tail = band === null || market === null ? null : band.startsWith(market.asset) ? band.slice(market.asset.length) : ` ${band}`;
  const ink = side === "up" ? color.profit : color.loss;
  return (
    <View style={styles.preview}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{C.calling}</Text>
      <View style={[styles.chip, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
        {market ? <AssetDisc asset={market.asset} size={20} /> : null}
        <SymbolView name={side === "up" ? { ios: "arrowtriangle.up.fill", android: "arrow_drop_up" } : { ios: "arrowtriangle.down.fill", android: "arrow_drop_down" }} size={11} tintColor={ink} />
        <Text style={[styles.chipDir, { color: ink }]}>{side === "up" ? "UP" : "DOWN"}</Text>
        <Text style={[TYPE.data, { color: color.inkMuted }]}>·</Text>
        <Text style={[TYPE.data, styles.chipBand, { color: color.ink }]} numberOfLines={2}>
          {market ? (
            <>
              <Text style={{ color: color.accent }}>${market.asset}</Text>
              {tail}
            </>
          ) : (
            "—"
          )}
        </Text>
      </View>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        · {market ? TAKES.window(formatCadence(market.intervalSec)) : C.noMarket}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sides: { flexDirection: "row", gap: 8 },
  side: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: RADIUS.md, borderWidth: 1 },
  sideText: { fontFamily: FONT.bodyStrong, fontSize: 15 },
  horizon: { gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cadence: { minWidth: 64, minHeight: 44, paddingHorizontal: 14, borderRadius: RADIUS.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  preview: { gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, borderRadius: RADIUS.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  chipDir: { fontFamily: FONT.dataStrong, fontSize: 12, letterSpacing: 0.6 },
  chipBand: { flexShrink: 1 },
});
