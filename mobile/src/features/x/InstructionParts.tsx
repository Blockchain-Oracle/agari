import { Check, Copy } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { X_HANDLE } from "@/features/x/copy";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";

/** x-instruction.css sizes in rem; the island's root is 15 px at phone width. */
export const XI = (rem: number) => rem * 15;

const AMOUNTS = ["5", "10", "25"] as const;

/** `.xi-field legend`: the label, with an optional muted aside on the right. */
export function Legend({ label, aside }: { label: string; aside?: string }) {
  const t = tradeXTokens(useTheme().name);
  return (
    <View style={styles.legend}>
      <Text style={[styles.legendText, { color: t.ink }]}>{label}</Text>
      {aside ? <Text style={[styles.legendAside, { color: t.xiMute }]}>{aside}</Text> : null}
    </View>
  );
}

/** `.xi-cadences`: three per row on a phone; a closed timeframe is dashed and cannot be picked. */
export function Cadences<C extends string>({ items, value, onPick }: {
  items: { name: C; label: string; open: boolean }[]; value: C; onPick: (name: C) => void;
}) {
  const t = tradeXTokens(useTheme().name);
  return (
    <View style={styles.cadences}>
      {items.map(({ name, label, open }) => {
        const on = value === name;
        return (
          <Pressable key={name} disabled={!open} onPress={() => onPick(name)} accessibilityRole="button" accessibilityState={{ selected: on, disabled: !open }} accessibilityLabel={`${name}, ${label.toLowerCase()}`}
            style={({ pressed }) => [styles.cadence, { borderColor: on ? t.v : t.xiLine, borderStyle: open ? "solid" : "dashed", backgroundColor: on ? t.xiCadenceOn : pressed ? t.xiHover : t.clear }, pressed && styles.down]}>
            {on ? <View pointerEvents="none" style={[styles.inset, { borderColor: t.v }]} /> : null}
            <Text style={[styles.cadenceName, { color: open ? t.ink : t.xiMute }]}>{name}</Text>
            <View style={styles.cadenceState}>
              <View style={[styles.cadenceDot, { backgroundColor: open ? t.xiUp : t.xiMute }]} />
              <Text style={[styles.small, { color: open ? t.xiUp : t.xiMute }]}>{label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** `.xi-amount-row`: the big amount input, then 5 / 10 / 25 / Max (each greyed past the X balance). */
export function AmountField({ amount, setAmount, symbol, decimals, balanceBase, maxAmount, error }: {
  amount: string; setAmount: (v: string) => void; symbol: string; decimals: number; balanceBase: bigint | null; maxAmount: string | null; error: string;
}) {
  const t = tradeXTokens(useTheme().name);
  const [focused, setFocused] = useState(false);
  const quick = [
    ...AMOUNTS.map((v) => ({ key: v, label: v, value: v, off: balanceBase !== null && BigInt(v) * 10n ** BigInt(decimals) > balanceBase })),
    { key: "max", label: "Max", value: maxAmount ?? "", off: !maxAmount || !balanceBase },
  ];
  return (
    <>
      <View style={styles.amountRow}>
        <View style={[styles.amount, { borderColor: focused ? t.v : t.xiLine, backgroundColor: t.xiAmountBg }]}>
          <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" accessibilityLabel={`Amount (${symbol})`}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} selectionColor={t.v} style={[styles.input, { color: t.ink }]} />
          <Text style={[styles.unit, { color: t.xiMute }]}>{symbol}</Text>
        </View>
        <View style={styles.quick} accessibilityLabel="Quick amounts">
          {quick.map((q) => {
            const on = q.key !== "max" && amount === q.value;
            return (
              <Pressable key={q.key} disabled={q.off} onPress={() => q.value && setAmount(q.value)} accessibilityRole="button" accessibilityState={{ selected: on }}
                accessibilityLabel={q.key === "max" ? "Use available X balance" : q.label}
                style={({ pressed }) => [styles.quickBtn, { borderColor: on || pressed ? t.xiMute : t.xiLine, backgroundColor: on || pressed ? t.xiQuickOn : t.clear }, q.off && styles.quickOff, pressed && styles.down]}>
                <Text style={[styles.quickText, { color: on ? t.ink : t.xiMute }]}>{q.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {error ? <Text style={[styles.error, { color: t.xiDown }]}>{error}</Text> : null}
    </>
  );
}

/** `.xi-post`: the cream "Your X post" preview, the vermilion Copy instruction button and the setup line. */
export function PostPreview({ side, asset, amount, cadence, canCopy, copied, enabled, failed, onCopy }: {
  side: "up" | "down"; asset: string; amount: string; cadence: string; canCopy: boolean; copied: boolean; enabled: boolean; failed: string; onCopy: () => void;
}) {
  const t = tradeXTokens(useTheme().name);
  const Icon = copied ? Check : Copy;
  const ink = canCopy ? t.xiCopyInk : t.xiCopyOffInk;
  return (
    <View style={[styles.post, { backgroundColor: t.xiPost }]}>
      <View style={styles.postLabel}>
        <Text style={[styles.postLabelText, { color: t.xiPostInk }]}>Your X post</Text>
        <Text style={[styles.postPreview, { color: t.xiPostMute }]}>Preview</Text>
      </View>
      <View style={styles.code}>
        <Text style={[styles.handle, { color: t.xiPostMute }]}>{X_HANDLE}</Text>
        <Text style={[styles.command, { color: t.xiPostInk }]}>
          {asset} <Text style={[styles.commandSide, { color: side === "up" ? t.xiCmdUp : t.xiCmdDown }]}>{side.toUpperCase()}</Text> {amount} {cadence}
        </Text>
      </View>
      <Pressable disabled={!canCopy} onPress={onCopy} accessibilityRole="button"
        style={({ pressed }) => [styles.copy, canCopy ? { backgroundColor: pressed ? t.xiCopyPressed : t.xiCopy, borderColor: t.xiCopy } : { backgroundColor: t.xiCopyOffBg, borderColor: t.xiCopyOffBorder }, pressed && styles.down]}>
        <Icon size={15} color={ink} strokeWidth={2} />
        <Text style={[styles.copyText, { color: ink }]}>{copied ? "Copied — paste into X" : "Copy instruction"}</Text>
      </Pressable>
      {!enabled ? <Text style={[styles.setup, { color: t.xiSetup }]}>Complete wallet, funding and X setup above to enable copying.</Text> : null}
      {failed ? <Text style={[styles.setup, { color: t.xiSetup }]} accessibilityRole="alert">{failed}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: XI(0.75), marginBottom: XI(0.65) },
  legendText: { fontFamily: FONT.bodyStrong, fontSize: XI(0.8125), lineHeight: 19.5 },
  legendAside: { flexShrink: 1, fontFamily: FONT.body, fontSize: XI(0.6875), lineHeight: 16.5 },
  cadences: { flexDirection: "row", gap: XI(0.5) },
  cadence: { flex: 1, alignItems: "center", gap: XI(0.35), minHeight: XI(3.5), paddingVertical: XI(0.6), paddingHorizontal: XI(0.2), borderWidth: 1, borderRadius: XI(0.625) },
  inset: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderRadius: XI(0.625) - 1 },
  down: { transform: [{ translateY: 1 }] },
  cadenceName: { fontFamily: FONT.dataStrong, fontSize: XI(0.9375), lineHeight: 22.5 },
  cadenceState: { flexDirection: "row", alignItems: "center", gap: XI(0.3) },
  cadenceDot: { width: XI(0.25), height: XI(0.25), borderRadius: XI(0.125) },
  small: { fontFamily: FONT.body, fontSize: XI(0.625), lineHeight: 15 },
  amountRow: { gap: XI(0.75) },
  amount: { flexDirection: "row", alignItems: "baseline", gap: XI(0.5), paddingVertical: XI(0.5), paddingHorizontal: XI(0.85), borderWidth: 1, borderRadius: XI(0.75) },
  input: { flex: 1, minWidth: 0, padding: 0, fontFamily: FONT.dataRegular, fontSize: XI(1.75), lineHeight: 42, letterSpacing: -1.575, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.dataRegular, fontSize: XI(0.6875), lineHeight: 16.5 },
  quick: { flexDirection: "row", gap: XI(0.375) },
  quickBtn: { flex: 1, minHeight: XI(2.75), padding: XI(0.5), borderWidth: 1, borderRadius: XI(0.5), alignItems: "center", justifyContent: "center" },
  quickOff: { opacity: 0.45 },
  quickText: { fontFamily: FONT.dataRegular, fontSize: XI(0.75), lineHeight: 18 },
  error: { marginTop: XI(0.65), fontFamily: FONT.body, fontSize: XI(0.75), lineHeight: 16.875 },
  post: { marginTop: XI(1.5), paddingTop: XI(1), paddingHorizontal: XI(1.125), paddingBottom: XI(1.125), borderRadius: XI(0.875) },
  postLabel: { flexDirection: "row", justifyContent: "space-between", gap: XI(1) },
  postLabelText: { fontFamily: FONT.bodyStrong, fontSize: XI(0.625), lineHeight: 15, letterSpacing: 1.125, textTransform: "uppercase" },
  postPreview: { fontFamily: FONT.body, fontSize: XI(0.625), lineHeight: 15 },
  code: { marginVertical: XI(1) },
  handle: { fontFamily: FONT.dataRegular, fontSize: XI(0.75), lineHeight: 18 },
  command: { marginTop: XI(0.375), fontFamily: FONT.dataRegular, fontSize: 18.09, lineHeight: 25.33, letterSpacing: -0.72 },
  commandSide: { fontFamily: FONT.dataStrong },
  copy: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: XI(0.5), minHeight: XI(2.875), borderWidth: 1, borderRadius: XI(0.5) },
  copyText: { fontFamily: FONT.bodyStrong, fontSize: XI(0.8125), lineHeight: 19.5 },
  setup: { marginTop: XI(0.65), fontFamily: FONT.body, fontSize: XI(0.6875), lineHeight: 15.47 },
});
