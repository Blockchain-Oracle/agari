import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { X_GRANT } from "@agari/core/x";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { TRADE_FROM_X } from "@/features/x/copy";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";
import { Dot } from "./StepSpine";

const PRESETS = ["5", "10", "25"] as const;
const R = TRADE_FROM_X.receipt;

/**
 * web's CapabilityReceipt.tsx: the X allocation and the executor's one power (open a position you own) before the
 * wallet confirms. The button submits the deposit-and-grant straight away; the wallet prompt is the confirmation.
 */
export function FundReceipt({ amount, setAmount, disabled, depositing, firstTime, decimals, symbol, onDeposit }: {
  amount: string;
  setAmount: (value: string) => void;
  disabled: boolean;
  depositing: boolean;
  firstTime: boolean;
  decimals: number;
  symbol: string;
  onDeposit: (amountBase: bigint) => void;
}) {
  const t = tradeXTokens(useTheme().name);
  const [focused, setFocused] = useState(false);
  const amountBase = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
  const shown = amountBase > 0n ? formatBaseUnits(amountBase, decimals) : "—";
  const [l1, l2, l3, l4, l5] = R.lede(shown, symbol);
  const [c1, c2, c3, c4, c5] = R.canText(shown, X_GRANT.openWindows);
  const [n1, n2, n3] = R.line(shown, symbol);
  const ctaOff = disabled || depositing || amountBase <= 0n;
  return (
    <View>
      <Text style={[styles.lede, { color: t.gray200 }]}>
        {l1}<Text style={{ color: t.white }}>{l2}</Text>{l3}<Text style={{ color: t.v }}>{l4}</Text>{l5}
      </Text>
      <View style={styles.amountRow}>
        <View style={[styles.amount, { borderColor: focused ? t.amountFocus : t.amountBorder }]}>
          <TextInput
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="decimal-pad"
            editable={!disabled}
            accessibilityLabel={R.amountAria}
            selectionColor={t.v}
            style={[styles.input, { color: t.ink }]}
          />
          <Text style={[styles.unit, { color: t.gray500 }]}>{symbol}</Text>
        </View>
        {PRESETS.map((p) => (
          <Pressable key={p} disabled={disabled} onPress={() => setAmount(p)} accessibilityRole="button" style={({ pressed }) => [styles.preset, { borderColor: pressed ? t.amountFocus : t.presetBorder }, disabled && styles.off]}>
            {({ pressed }) => <Text style={[styles.presetText, { color: pressed ? t.white : t.gray400 }]}>+{p}</Text>}
          </Pressable>
        ))}
      </View>
      <View style={styles.ledger}>
        <View style={[styles.cell, { borderColor: t.canBorder, backgroundColor: t.canBg }]}>
          <View style={styles.head}>
            <Dot />
            <Text style={[styles.headText, { color: t.canHead }]}>{R.can}</Text>
          </View>
          <Text style={[styles.cellText, { color: t.gray300 }]}>
            {c1}<Text style={{ color: t.white }}>{c2}</Text>{c3}<Text style={{ color: t.white }}>{c4}</Text>{c5}
          </Text>
        </View>
        <View style={[styles.cell, { borderColor: t.cannotBorder, backgroundColor: t.cannotBg }]}>
          <View style={styles.head}>
            <Dot v />
            <Text style={[styles.headText, { color: t.cannotHead }]}>{R.cannot}</Text>
          </View>
          <Text style={[styles.cellText, { color: t.gray400 }]}>
            <Text style={[styles.struck, { textDecorationColor: t.struck }]}>{R.cannotStruck}</Text>
            {R.cannotTail}
          </Text>
        </View>
      </View>
      <View style={[styles.line, { borderColor: t.lineBorder, backgroundColor: t.lineBg }]}>
        <Text style={[styles.lineText, { color: t.gray400 }]}>
          {n1}<Text style={{ color: t.gray200 }}>{n2}</Text>{n3}
        </Text>
      </View>
      <Pressable
        disabled={ctaOff}
        onPress={() => onDeposit(amountBase)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, { backgroundColor: t.v }, ctaOff && styles.ctaOff, pressed && styles.ctaPressed]}
      >
        <Text style={[styles.ctaText, { color: t.bg }]}>{depositing ? R.busy : firstTime ? R.ctaApprove : R.cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  lede: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 20.625, marginBottom: 16 },
  amountRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 16 },
  amount: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  input: { width: 56, padding: 0, fontFamily: FONT.dataRegular, fontSize: 18, lineHeight: 28 },
  unit: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 20 },
  preset: { borderRadius: 8, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  presetText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16 },
  off: { opacity: 0.4 },
  ledger: { gap: 10, marginBottom: 16 },
  cell: { borderRadius: 12, borderWidth: 1, padding: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  headText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase" },
  cellText: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20.3 },
  struck: { textDecorationLine: "line-through", textDecorationStyle: "solid" },
  line: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 14 },
  lineText: { fontFamily: FONT.dataRegular, fontSize: 11.5, lineHeight: 18.4 },
  cta: { alignSelf: "stretch", borderRadius: 9999, paddingVertical: 12, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  ctaOff: { opacity: 0.4 },
  ctaPressed: { transform: [{ translateY: 1 }, { scale: 0.99 }] },
  ctaText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
});
