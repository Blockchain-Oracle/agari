import type { Side } from "@agari/core/types";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PREOPEN } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** web's PriceControl constants (a DOM file, so restated): the default a bettor with a lean would name, and the chips. */
export const DEFAULT_PRICE_CENTS = 55;
const PRICE_CHIPS = [50, 55, 60, 70] as const;
const MIN_CENTS = 1;
const MAX_CENTS = 99;

/**
 * web's PriceControl: the call's own price in whole cents (D-088) — a 1¢ stepper around the big figure and four quick
 * chips, in the amount block's grammar so the two sizing controls read as one column. Always an integer 1..99.
 */
export function PriceControl({ priceCents, onChange, side, symbol }: { priceCents: number; onChange: (cents: number) => void; side: Side | null; symbol: string }) {
  const { color } = useTheme();
  const step = (by: number) => {
    haptic.select();
    onChange(Math.min(MAX_CENTS, Math.max(MIN_CENTS, priceCents + by)));
  };
  const stepper = (by: number, label: string, icon: "minus" | "plus") => {
    const disabled = by < 0 ? priceCents <= MIN_CENTS : priceCents >= MAX_CENTS;
    return (
      <Pressable
        onPress={() => step(by)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.step, { borderColor: color.hairline, backgroundColor: pressed ? color.surface3 : color.surface2, opacity: disabled ? 0.4 : 1 }]}
      >
        <SymbolView name={{ ios: icon, android: icon === "minus" ? "remove" : "add" }} size={18} tintColor={color.ink} />
      </Pressable>
    );
  };
  return (
    <View style={[styles.block, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{PREOPEN.ticket.priceLabel}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{PREOPEN.ticket.pays(symbol)}</Text>
      </View>
      <View style={styles.field} accessibilityRole="adjustable" accessibilityLabel={PREOPEN.ticket.priceAria(side ? SIDE_WORD[side] : "")} accessibilityValue={{ text: `${priceCents} cents` }}>
        {stepper(-1, PREOPEN.ticket.step.down, "minus")}
        <Text style={[styles.figure, { color: color.ink }]}>
          {priceCents}
          <Text style={[styles.unit, { color: color.inkMuted }]}>¢</Text>
        </Text>
        {stepper(1, PREOPEN.ticket.step.up, "plus")}
      </View>
      <View style={styles.chips} accessibilityLabel={PREOPEN.ticket.priceChips}>
        {PRICE_CHIPS.map((cents) => {
          const on = cents === priceCents;
          return (
            <Pressable
              key={cents}
              onPress={() => {
                haptic.select();
                onChange(cents);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : color.surface2 }]}
            >
              <Text style={[TYPE.data, { color: on ? color.accent : color.ink }]}>{cents}¢</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14, gap: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  field: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  step: { width: 52, height: 52, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  figure: { fontFamily: FONT.dataStrong, fontSize: 40, lineHeight: 48, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.data, fontSize: 20 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, height: 44, borderRadius: RADIUS.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
