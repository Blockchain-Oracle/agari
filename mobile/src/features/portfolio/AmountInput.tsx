import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { VAULT } from "@/features/vault/copy";
import { Button, Field } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

/** web `AmountField.amountProblem`: why the typed amount cannot go, or null. */
export function amountProblem(value: string, decimals: number, maxBase: bigint | null, symbol: string): string | null {
  if (value.trim() === "") return null;
  const base = parseDecimalToBaseUnits(value.trim(), decimals);
  if (base === null) return VAULT.amount.notANumber;
  if (maxBase !== null && base > maxBase) return VAULT.amount.overWallet(`${formatBaseUnits(maxBase, decimals)} ${symbol}`);
  return null;
}

/** The whole of `maxBase` as typeable text: no grouping commas, no trailing zeros. */
export function plainAmount(base: bigint, decimals: number): string {
  return formatBaseUnits(base, decimals, { minDp: 0 }).replace(/,/g, "");
}

interface AmountInputProps {
  value: string;
  onChange: (text: string) => void;
  decimals: number;
  symbol: string;
  /** What the source can move; null while it is being read. */
  maxBase: bigint | null;
  label: string;
  /** The hint's own words for the source ("Wallet: 12.5 tUSDC"). */
  holdsText?: (amount: string) => string;
}

/**
 * web `AmountField` (S23): an amount with a Max and a reason — it turns red and says why when it asks for more than
 * the source holds, so a disabled button is never left without a word.
 */
export function AmountInput({ value, onChange, decimals, symbol, maxBase, label, holdsText = VAULT.amount.walletHolds }: AmountInputProps) {
  const problem = amountProblem(value, decimals, maxBase, symbol);
  const hint = maxBase !== null ? holdsText(`${formatBaseUnits(maxBase, decimals)} ${symbol}`) : undefined;
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.field}>
          <Field label={label} value={value} onChangeText={onChange} numeric placeholder="0.00" suffix={symbol} error={problem ?? undefined} />
        </View>
        <Button
          label={VAULT.amount.max}
          variant="outline"
          size="md"
          block={false}
          disabled={maxBase === null || maxBase <= 0n}
          onPress={() => maxBase !== null && onChange(plainAmount(maxBase, decimals))}
          accessibilityHint={hint}
          style={styles.max}
        />
      </View>
      {!problem && hint ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  field: { flex: 1 },
  max: { marginTop: 17, height: 50 },
});
