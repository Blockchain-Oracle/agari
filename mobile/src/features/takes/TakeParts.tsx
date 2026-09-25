import { formatCadence } from "@agari/core/copy";
import type { EventMarket, Side } from "@agari/core/types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { TAKES } from "@/features/takes/copy";
import type { ComposerHorizon } from "@/features/takes/useComposerMarket";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { takesTokens } from "~/theme/web/takes";

const C = TAKES.composer;

/** take-composer.css `.take-sides`: three equal cells — Up, Down, and Range disabled at 30 %, naming what it waits on. */
export function SidePicker({ side, onSide }: { side: Side; onSide: (side: Side) => void }) {
  const { name, color } = useTheme();
  const t = takesTokens(name);
  const options: ReadonlyArray<{ key: Side | "range"; label: string }> = [
    { key: "up", label: C.up },
    { key: "down", label: C.down },
    { key: "range", label: C.range },
  ];
  return (
    <View style={styles.sides}>
      {options.map((option) => {
        const disabled = option.key === "range";
        const on = option.key === side;
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
            style={[styles.cell, styles.side, { borderColor: on ? t.sideOnBorder : t.ink12, backgroundColor: on ? t.sideOnFill : "transparent" }, disabled && styles.off]}
          >
            <Text style={[styles.sideText, { color: on ? color.accent : t.ink50 }]}>{option.label.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** `.take-horizon`: the live lanes' cadences, three to a row; a cadence with no enterable Window is disabled. */
export function HorizonRow({ horizon }: { horizon: ComposerHorizon }) {
  const { name } = useTheme();
  const t = takesTokens(name);
  return (
    <View style={styles.horizon}>
      <Text style={[styles.label, styles.horizonLabel, { color: t.ink40 }]}>{C.horizon.toUpperCase()}</Text>
      {horizon.lanes.length === 0 ? (
        <Text style={[styles.note, { color: t.ink30 }]}>{C.noWindows}</Text>
      ) : (
        <View style={styles.sides}>
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
                style={[styles.cell, styles.cadence, { borderColor: on ? t.ink40 : t.ink12, backgroundColor: on ? t.ink05 : "transparent" }, !live && styles.off]}
              >
                <Text style={[styles.cadenceText, { color: on ? t.ink : t.ink50 }]}>{formatCadence(lane.intervalSec)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** `.take-preview`: the card's call chip mirrored (D-082) — mark, direction, the cashtag and the band's words — then the Window. */
export function TakePreview({ market, side, lineRaw }: { market: EventMarket | null; side: Side; lineRaw: bigint | null }) {
  const { name, color } = useTheme();
  const t = takesTokens(name);
  const band =
    market === null ? null : lineRaw === null ? TAKES.noLine(market.asset) : side === "up" ? TAKES.over(market.asset, assetPriceLine(market.asset, lineRaw)) : TAKES.under(market.asset, assetPriceLine(market.asset, lineRaw));
  const tail = band === null || market === null ? null : band.startsWith(market.asset) ? band.slice(market.asset.length) : ` ${band}`;
  return (
    <View style={[styles.preview, { borderColor: t.ink06, backgroundColor: t.ink015 }]}>
      <Text style={[styles.label, { color: t.ink35 }]}>{C.calling.toUpperCase()}</Text>
      <View style={styles.call}>
        <View style={[styles.chip, { borderColor: t.chipBorder, backgroundColor: t.chipFill }]}>
          {market ? <AssetDisc asset={market.asset} size={16} /> : null}
          <Text style={[styles.chipText, { color: color.accent }]}>{side === "up" ? "▲ UP" : "▼ DOWN"}</Text>
          <Text style={[styles.chipText, { color: t.ink25 }]}>·</Text>
          <Text style={[styles.chipText, styles.shrink, { color: t.ink65 }]} numberOfLines={2}>
            {market ? (
              <>
                <Text style={{ color: t.ink85 }}>${market.asset}</Text>
                {tail?.toUpperCase()}
              </>
            ) : (
              "—"
            )}
          </Text>
        </View>
        <Text style={[styles.window, { color: t.ink40 }]}>· {market ? TAKES.window(formatCadence(market.intervalSec)) : C.noMarket}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sides: { marginTop: 16, flexDirection: "row", gap: 8 },
  cell: { flex: 1, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  side: { paddingVertical: 10 },
  sideText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 16.5, letterSpacing: 1.54 },
  off: { opacity: 0.3 },
  horizon: { marginTop: 12 },
  label: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5, letterSpacing: 1.44 },
  horizonLabel: { marginBottom: 6 },
  note: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5 },
  cadence: { paddingVertical: 8 },
  cadenceText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  preview: { marginTop: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  call: { marginTop: 2, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 9999, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 14, maxWidth: "100%" },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15, letterSpacing: 1.6 },
  shrink: { flexShrink: 1 },
  window: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18 },
});
