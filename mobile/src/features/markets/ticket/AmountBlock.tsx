import { LEVERAGE_MULTIPLES } from "@agari/core/leverage";
import { minStakeBase } from "@agari/core/sizing";
import { formatBaseUnits, oneUnit } from "@agari/core/units";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LEVERAGE } from "@/features/leverage/copy";
import { TICKET, TICKET_PENDING } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { AmountPad } from "~/components/ui/AmountPad";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** web's additive chips (`Ticket624Drawer.tsx` L1067–1073): the amount is always the user's. */
const ADDS = [1, 5, 20] as const;

export interface LeverageChoice {
  value: number;
  onChange: (multiple: number) => void;
  /** The LeverageReserve is deployed on this network. */
  available: boolean;
  maxMultiple: number;
  /** Why the higher multiples cannot be chosen now (the route, a pause); null when they can. */
  lockedReason: string | null;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  stakeBase: bigint;
  onStakeBase: (base: bigint) => void;
  /** What the chosen source can put behind a bet; null until read. */
  balanceBase: bigint | null;
  decimals: number;
  symbol: string;
  belowMin: boolean;
  /** The 1×/2×/3× chips; null on a scheduled call, which is placed at 1× only. */
  leverage: LeverageChoice | null;
}

/**
 * web's AmountBlock, stake-first for a thumb: the label and the balance, the big mono figure with its unit, the additive
 * +1 +5 +20 chips beside the leverage chips, then the keypad. The figure is a string until core's integer parser turns
 * it into base units; no float ever touches the stake.
 */
export function AmountBlock({ value, onChange, stakeBase, onStakeBase, balanceBase, decimals, symbol, belowMin, leverage }: Props) {
  const { color } = useTheme();
  const [lockedWhy, setLockedWhy] = useState<string | null>(null);
  const add = (units: number) => {
    haptic.select();
    onStakeBase(stakeBase + BigInt(units) * oneUnit(decimals));
  };
  const shown = value === "" ? TICKET.stakePlaceholder : value;
  return (
    <View style={[styles.block, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{TICKET.amount}</Text>
        {balanceBase !== null ? <Text style={[TYPE.data, { color: color.inkSecondary }]}>{TICKET.balance(formatBaseUnits(balanceBase, decimals))}</Text> : null}
      </View>
      <Text style={[styles.figure, { color: value === "" ? color.inkMuted : color.ink }]} accessibilityLabel={TICKET.amountAria(symbol)} accessibilityValue={{ text: `${shown} ${symbol}` }} adjustsFontSizeToFit numberOfLines={1}>
        {shown}
        <Text style={[styles.unit, { color: color.inkMuted }]}> {symbol}</Text>
      </Text>
      <View style={styles.row}>
        <View style={styles.adds}>
          {ADDS.map((units) => (
            <Pressable key={units} onPress={() => add(units)} accessibilityRole="button" accessibilityLabel={`Add ${units} ${symbol}`} style={({ pressed }) => [styles.add, { borderColor: color.hairline, backgroundColor: pressed ? color.surface3 : color.surface2 }]}>
              <Text style={[TYPE.data, { color: color.ink }]}>+{units}</Text>
            </Pressable>
          ))}
        </View>
        {leverage ? <LeverageChips {...leverage} onLocked={setLockedWhy} /> : null}
      </View>
      {lockedWhy ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{lockedWhy}</Text> : null}
      {belowMin ? <Text style={[TYPE.caption, { color: color.loss }]}>{TICKET.minimum(`${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`)}</Text> : null}
      <AmountPad value={value} onChange={onChange} />
    </View>
  );
}

/**
 * web's LeverageChips: 1× is a plain order, a higher multiple a boost the reserve buys. A chip that cannot be chosen
 * stays in place, dimmed, and says why under the row when pressed (web's title).
 */
function LeverageChips({ value, onChange, available, maxMultiple, lockedReason, onLocked }: LeverageChoice & { onLocked: (why: string | null) => void }) {
  const { color } = useTheme();
  const reasonFor = (multiple: number) => {
    if (multiple === 1) return null;
    if (!available) return TICKET_PENDING.leveragePending(LEVERAGE.multiple(multiple));
    if (lockedReason) return lockedReason;
    if (multiple > maxMultiple) return TICKET_PENDING.leverageCapped(LEVERAGE.multiple(multiple), LEVERAGE.multiple(maxMultiple));
    return null;
  };
  return (
    <View style={styles.levs} accessibilityRole="radiogroup" accessibilityLabel={LEVERAGE.label}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{LEVERAGE.label}</Text>
      {LEVERAGE_MULTIPLES.map((multiple) => {
        const reason = reasonFor(multiple);
        const on = value === multiple;
        return (
          <Pressable
            key={multiple}
            onPress={() => {
              onLocked(reason);
              if (reason) {
                haptic.error();
                return;
              }
              haptic.select();
              onChange(multiple);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: reason !== null }}
            accessibilityHint={reason ?? (multiple > 1 ? LEVERAGE.boostHint : undefined)}
            style={[styles.lev, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : "transparent", opacity: reason ? 0.4 : 1 }]}
          >
            <Text style={[TYPE.data, { color: on ? color.accent : color.ink }]}>{LEVERAGE.multiple(multiple)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 14, gap: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  figure: { fontFamily: FONT.dataStrong, fontSize: 44, lineHeight: 52, textAlign: "center", fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.data, fontSize: 18 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  adds: { flexDirection: "row", gap: 6 },
  add: { minWidth: 48, height: 44, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  levs: { flexDirection: "row", alignItems: "center", gap: 5 },
  lev: { minWidth: 44, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
