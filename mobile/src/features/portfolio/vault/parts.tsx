import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { VAULT } from "@/features/vault/copy";
import { usePortfolioTokens } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";
import { usePlateInk } from "../usePlateInk";

type Kind = "primary" | "outline" | "private";

/** vault.css `.vault-btn` (+ `-primary` / `-outline` / `-private`): 44 tall, radius 12, 10 px mono bold caps; off reads as off. */
export function VaultButton({ label, kind, disabled, onPress, grow }: { label: string; kind: Kind; disabled: boolean; onPress: () => void; grow?: boolean }) {
  const { color } = useTheme();
  const ink = usePlateInk();
  const t = usePortfolioTokens();
  const look = {
    primary: disabled ? { bg: ink.raised, border: t.vInk18, fg: ink.mute, dashed: false } : { bg: color.accent, border: color.accent, fg: color.onAccent, dashed: false },
    outline: disabled ? { bg: "transparent", border: t.vInk22, fg: ink.mute, dashed: true } : { bg: "transparent", border: t.vInk45, fg: ink.ink, dashed: false },
    private: disabled ? { bg: "transparent", border: t.vProfit30, fg: t.vProfit55, dashed: true } : { bg: color.profitWash, border: t.vProfit60, fg: color.profit, dashed: false },
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.btn, grow && styles.grow, { backgroundColor: look.bg, borderColor: look.border, borderStyle: look.dashed ? "dashed" : "solid" }]}
    >
      <Text style={[styles.btnText, { color: look.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function amountProblem(value: string, decimals: number, maxBase: bigint | null, symbol: string): string | null {
  if (value.trim() === "") return null;
  const base = parseDecimalToBaseUnits(value.trim(), decimals);
  if (base === null) return VAULT.amount.notANumber;
  if (maxBase !== null && base > maxBase) return VAULT.amount.overWallet(`${formatBaseUnits(maxBase, decimals)} ${symbol}`);
  return null;
}

/** web `AmountField` (S23): the ink-bordered well on the raised paper, Max inside it, the reason in loss ink under it. */
export function AmountField({ value, onChange, decimals, symbol, maxBase, label }: { value: string; onChange: (t: string) => void; decimals: number; symbol: string; maxBase: bigint | null; label: string }) {
  const { color } = useTheme();
  const ink = usePlateInk();
  const t = usePortfolioTokens();
  const problem = amountProblem(value, decimals, maxBase, symbol);
  const maxOff = maxBase === null || maxBase <= 0n;
  return (
    <View style={styles.amount}>
      <View style={styles.amountRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          placeholder="0.00"
          placeholderTextColor={ink.mute}
          style={[styles.input, { borderColor: problem ? color.loss : t.vInk22, backgroundColor: ink.raised, color: ink.ink }]}
        />
        <Pressable
          disabled={maxOff}
          onPress={() => maxBase !== null && onChange(formatBaseUnits(maxBase, decimals, { minDp: 0 }).replace(/,/g, ""))}
          accessibilityRole="button"
          style={[styles.max, maxOff ? { borderColor: t.vInk18, backgroundColor: "transparent" } : { borderColor: color.accentDim, backgroundColor: color.accentWash }]}
        >
          <Text style={[styles.maxText, { color: maxOff ? ink.mute : color.accent }]}>{VAULT.amount.max}</Text>
        </Pressable>
      </View>
      {problem ? (
        <Text style={[styles.small, { color: color.loss }]} accessibilityRole="alert">
          {problem}
        </Text>
      ) : maxBase !== null ? (
        <Text style={[styles.small, { color: ink.mute }]}>{VAULT.amount.walletHolds(`${formatBaseUnits(maxBase, decimals)} ${symbol}`)}</Text>
      ) : null}
    </View>
  );
}

/** web `VaultCells` Cell: an 8 px mono caption over a 14 px mono figure, vermilion while in play. */
export function Cell({ label, value, note, live }: { label: string; value: string; note?: string; live?: boolean }) {
  const ink = usePlateInk();
  const t = usePortfolioTokens();
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.eyebrow, { color: ink.mute }]}>{label}</Text>
      <Text style={[styles.cellValue, { color: live ? t.vermilion : ink.ink }]}>{value}</Text>
      {note ? <Text style={[styles.caption, { color: ink.mute }]}>{note}</Text> : null}
    </View>
  );
}

export const vaultStyles = StyleSheet.create({
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.12, textTransform: "uppercase" },
  note: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
});

const styles = StyleSheet.create({
  btn: { height: 44, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  btnText: { fontFamily: FONT.dataStrong, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" },
  amount: { gap: 4, minWidth: 0 },
  amountRow: { justifyContent: "center" },
  input: { height: 44, borderRadius: 12, borderWidth: 1, paddingLeft: 12, paddingRight: 56, fontFamily: FONT.dataRegular, fontSize: 14 },
  max: { position: "absolute", right: 6, height: 30, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, justifyContent: "center" },
  maxText: { fontFamily: FONT.dataStrong, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  small: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  cell: { flexBasis: "40%", flexGrow: 1 },
  eyebrow: vaultStyles.eyebrow,
  cellValue: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4, fontVariant: ["tabular-nums"] },
  caption: vaultStyles.caption,
});
