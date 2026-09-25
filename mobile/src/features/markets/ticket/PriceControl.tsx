import { isPriceCents } from "@agari/core/orders";
import type { Side } from "@agari/core/types";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PREOPEN } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { Chip } from "./AmountBlock";
import { tkType, useTk } from "./tk";

/** web's PriceControl constants (a DOM file, so restated): the default a bettor with a lean would name, and the chips. */
export const DEFAULT_PRICE_CENTS = 55;
const PRICE_CHIPS = [50, 55, 60, 70] as const;
const MIN_CENTS = 1;
const MAX_CENTS = 99;

/**
 * web's PriceControl (D-088): the call's own price in whole cents — a 1¢ stepper either side of the figure and four
 * quick chips, in the amount block's own grammar so the two sizing controls read as one column. Always 1..99; a
 * keystroke that isn't one changes nothing until it is.
 */
export function PriceControl({ priceCents, onChange, side, symbol }: { priceCents: number; onChange: (cents: number) => void; side: Side | null; symbol: string }) {
  const tk = useTk();
  const [text, setText] = useState(String(priceCents));
  useEffect(() => setText(String(priceCents)), [priceCents]);
  const step = (by: number) => {
    haptic.select();
    onChange(Math.min(MAX_CENTS, Math.max(MIN_CENTS, priceCents + by)));
  };
  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setText(digits);
    const cents = Number(digits);
    if (digits && isPriceCents(cents)) onChange(cents);
  };
  return (
    <View style={[styles.block, { borderColor: tk.rule }]}>
      <View style={styles.head}>
        <Text style={[tkType.label, { color: tk.label }]}>{PREOPEN.ticket.priceLabel}</Text>
        <Text style={[tkType.chip, { color: tk.balance }]}>{PREOPEN.ticket.pays(symbol)}</Text>
      </View>
      <View style={styles.field}>
        <Chip label="−" wide disabled={priceCents <= MIN_CENTS} onPress={() => step(-1)} />
        <TextInput
          value={text}
          onChangeText={type}
          onBlur={() => setText(String(priceCents))}
          keyboardType="number-pad"
          autoComplete="off"
          selectionColor={tk.vermilion}
          accessibilityLabel={PREOPEN.ticket.priceAria(side ? SIDE_WORD[side] : "")}
          style={[styles.input, { color: tk.ink }]}
        />
        <Text style={[styles.unit, { color: tk.balance }]}>¢</Text>
        <Chip label="+" wide disabled={priceCents >= MAX_CENTS} onPress={() => step(1)} />
      </View>
      <View style={styles.row} accessibilityLabel={PREOPEN.ticket.priceChips}>
        {PRICE_CHIPS.map((cents) => (
          <Chip
            key={cents}
            label={`${cents}¢`}
            on={cents === priceCents}
            onPress={() => {
              haptic.select();
              onChange(cents);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  field: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minWidth: 0, height: 33, padding: 0, fontFamily: FONT.heading, fontSize: 26.25, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08 },
  row: { marginTop: 10, flexDirection: "row", gap: 4 },
});
