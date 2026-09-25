import { LEVERAGE_MULTIPLES } from "@agari/core/leverage";
import { minStakeBase } from "@agari/core/sizing";
import { formatBaseUnits, oneUnit } from "@agari/core/units";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LEVERAGE } from "@/features/leverage/copy";
import { TICKET, TICKET_PENDING } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { tkType, useTk } from "./tk";

/** web's additive chips (`Ticket624Drawer.tsx` L1067–1073): the amount is always the user's. */
const ADDS = [1, 5, 20] as const;

export interface LeverageChoice {
  value: number;
  onChange: (multiple: number) => void;
  /** The LeverageReserve is deployed on this network; without it the higher chips stay and are disabled. */
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
  /** Wallet plus credit — the real buying power, as one number; null until read. */
  balanceBase: bigint | null;
  decimals: number;
  symbol: string;
  belowMin: boolean;
  /** The 1×/2×/3× chips on the row's right; null on a range bet or a scheduled call. */
  leverage: LeverageChoice | null;
}

/** Keeps only digits and a single decimal point; the parser downstream rejects anything else anyway. */
function sanitize(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("")}` : whole;
}

/**
 * web's AmountBlock: one ruled block — the label and the balance, the big display figure with its unit, then the
 * additive `+1 +5 +20` chips on the left and the leverage chips on the right, and the minimum said once there is an
 * amount to judge. The figure is a string until core's integer parser turns it into base units.
 */
export function AmountBlock({ value, onChange, stakeBase, onStakeBase, balanceBase, decimals, symbol, belowMin, leverage }: Props) {
  const tk = useTk();
  const add = (units: number) => {
    haptic.select();
    onStakeBase(stakeBase + BigInt(units) * oneUnit(decimals));
  };
  return (
    <View style={[styles.block, { borderColor: tk.rule }]}>
      <View style={styles.head}>
        <Text style={[tkType.label, { color: tk.label }]}>{TICKET.amount}</Text>
        {balanceBase !== null ? <Text style={[tkType.chip, { color: tk.balance }]}>{TICKET.balance(formatBaseUnits(balanceBase, decimals))}</Text> : null}
      </View>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(sanitize(text))}
          placeholder={TICKET.stakePlaceholder}
          placeholderTextColor={tk.placeholder}
          keyboardType="decimal-pad"
          autoComplete="off"
          autoCorrect={false}
          selectionColor={tk.vermilion}
          accessibilityLabel={TICKET.amountAria(symbol)}
          style={[styles.input, { color: tk.ink }]}
        />
        <Text style={[styles.unit, { color: tk.balance }]}>{symbol}</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.adds}>
          {ADDS.map((units) => (
            <Chip key={units} label={`+${units}`} onPress={() => add(units)} />
          ))}
        </View>
        {leverage ? <LeverageChips {...leverage} /> : null}
      </View>
      {belowMin ? <Text style={[tkType.chip, styles.min, { color: tk.vermilion }]}>{TICKET.minimum(`${formatBaseUnits(minStakeBase(decimals), decimals, { minDp: 0 })} ${symbol}`)}</Text> : null}
    </View>
  );
}

/** web's `.tk-add`: a small mono chip; pressed (a price chip) it takes the vermilion border and ink. */
export function Chip({ label, onPress, on = false, disabled = false, wide = false }: { label: string; onPress: () => void; on?: boolean; disabled?: boolean; wide?: boolean }) {
  const tk = useTk();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, { borderColor: on ? tk.vermilion : tk.addBorder }, wide && styles.step, pressed && styles.shrink, disabled && styles.dim]}
    >
      <Text style={[tkType.chip, wide && styles.stepText, { color: on ? tk.vermilion : tk.add }]}>{label}</Text>
    </Pressable>
  );
}

/** web's LeverageChips: the printed "Leverage" label and 1×/2×/3×; a multiple that cannot be placed stays, dimmed. */
function LeverageChips({ value, onChange, available, maxMultiple, lockedReason }: LeverageChoice) {
  const tk = useTk();
  return (
    <View style={styles.levs} accessibilityLabel={LEVERAGE.label}>
      <Text style={[tkType.label, styles.levsLabel, { color: tk.label }]}>{LEVERAGE.label}</Text>
      {LEVERAGE_MULTIPLES.map((multiple) => {
        const label = LEVERAGE.multiple(multiple);
        const reason = multiple === 1 ? null : !available ? TICKET_PENDING.leveragePending(label) : (lockedReason ?? (multiple > maxMultiple ? TICKET_PENDING.leverageCapped(label, LEVERAGE.multiple(maxMultiple)) : null));
        const on = value === multiple;
        return (
          <Pressable
            key={multiple}
            onPress={() => {
              haptic.select();
              onChange(multiple);
            }}
            disabled={reason !== null}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: reason !== null }}
            accessibilityHint={reason ?? (multiple > 1 ? LEVERAGE.boostHint : undefined)}
            hitSlop={6}
            style={[styles.chip, { borderColor: on ? tk.levOnBorder : tk.levBorder, backgroundColor: on ? tk.levOnBg : "transparent" }, reason !== null && styles.dim]}
          >
            <Text style={[tkType.chip, { color: on ? tk.levOnInk : tk.lev }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  field: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minWidth: 0, height: 33, padding: 0, fontFamily: FONT.heading, fontSize: 26.25, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08 },
  row: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  adds: { flexDirection: "row", gap: 4 },
  chip: { minWidth: 40, borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  step: { minWidth: 32 },
  stepText: { fontSize: 14, lineHeight: 14.4 },
  shrink: { transform: [{ scale: 0.95 }] },
  dim: { opacity: 0.35 },
  levs: { flexDirection: "row", alignItems: "center", gap: 4 },
  levsLabel: { marginRight: 4 },
  min: { marginTop: 8, textAlign: "left" },
});
