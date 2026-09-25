import { formatBaseUnits } from "@agari/core/units";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { X_CARD } from "@/features/x/copy";
import { FONT } from "~/theme";
import { useXInk } from "./ink";

const QUICK = ["5", "10", "25"] as const;
export type FundSource = "wallet" | "trading-balance";

interface XFundProps {
  amount: string;
  setAmount: (v: string) => void;
  source: FundSource;
  setSource: (v: FundSource) => void;
  /** The Trading Balance's spendable amount; the source choice shows only when it holds something. */
  availableBase: bigint | null;
  decimals: number;
  symbol: string;
  busy: boolean;
  fundBusy: boolean;
  fundDisabled: boolean;
  onFund: () => void;
}

/** web `XWalletCard`'s fund block: `.xw-source` (two options), `.xw-fund` (the quick amounts, the $ field, the ink button). */
export function XFund({ amount, setAmount, source, setSource, availableBase, decimals, symbol, busy, fundBusy, fundDisabled, onFund }: XFundProps) {
  const x = useXInk();
  const option = (value: FundSource, title: string, sub: string) => {
    const on = source === value;
    return (
      <Pressable
        key={value}
        disabled={busy}
        onPress={() => setSource(value)}
        accessibilityRole="button"
        accessibilityState={{ selected: on, disabled: busy }}
        style={[styles.option, { borderColor: on ? x.v : x.line, backgroundColor: on ? x.sourceOn : "transparent", borderWidth: on ? 2 : 1 }, busy && styles.half]}
      >
        <Text style={[styles.optTitle, { color: x.ink }]}>{title}</Text>
        <Text style={[styles.optSub, { color: x.mute }]}>{sub}</Text>
      </Pressable>
    );
  };
  return (
    <>
      {availableBase !== null && availableBase > 0n ? (
        <View style={styles.source}>
          <Text style={[styles.legend, { color: x.mute }]}>Fund from</Text>
          <View style={styles.options}>
            {option("wallet", "Connected wallet", "Add wallet funds")}
            {option("trading-balance", "Trading Balance", `${formatBaseUnits(availableBase, decimals)} ${symbol} available`)}
          </View>
        </View>
      ) : null}
      <View style={[styles.fund, { borderTopColor: x.line }]}>
        <View style={styles.quick}>
          {QUICK.map((v) => (
            <Pressable
              key={v}
              disabled={busy}
              onPress={() => setAmount(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: amount === v }}
              style={[styles.quickBtn, { borderColor: amount === v ? x.ink : x.line }]}
            >
              <Text style={[styles.quickText, { color: amount === v ? x.ink : x.mute }]}>${v}</Text>
            </Pressable>
          ))}
          <View style={[styles.amount, { borderColor: x.line, backgroundColor: x.paper }]}>
            <Text style={[styles.sign, { color: x.mute }]}>$</Text>
            <TextInput
              value={amount}
              editable={!busy}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              accessibilityLabel={X_CARD.amountAria}
              style={[styles.input, { color: x.ink }]}
            />
            <Text style={[styles.unit, { color: x.mute }]}>{symbol}</Text>
          </View>
        </View>
        <Pressable disabled={fundDisabled} onPress={onFund} accessibilityRole="button" style={[styles.fill, { backgroundColor: x.ink }, fundDisabled && styles.dim]}>
          <Text style={[styles.fillText, { color: x.plate }]}>{fundBusy ? X_CARD.funding : X_CARD.fund}</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  source: { marginTop: 16, marginBottom: 10 },
  legend: { marginBottom: 8, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  options: { flexDirection: "row", gap: 8 },
  option: { flex: 1, minWidth: 0, padding: 12, borderRadius: 10 },
  optTitle: { fontFamily: FONT.bodyBold, fontSize: 12, lineHeight: 16.8 },
  optSub: { marginTop: 4, fontFamily: FONT.body, fontSize: 10, lineHeight: 14 },
  half: { opacity: 0.5 },
  fund: { marginTop: 24, paddingTop: 20, gap: 10, borderTopWidth: 1 },
  quick: { flexDirection: "row", alignItems: "center", gap: 6 },
  quickBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1 },
  quickText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  amount: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1 },
  sign: { fontFamily: FONT.body, fontSize: 14 },
  input: { width: 56, padding: 0, fontFamily: FONT.body, fontSize: 14 },
  unit: { fontFamily: FONT.dataRegular, fontSize: 10 },
  fill: { alignItems: "center", justifyContent: "center", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  fillText: { fontFamily: FONT.heading, fontSize: 12, lineHeight: 19.2, letterSpacing: 1.2, textTransform: "uppercase" },
  dim: { opacity: 0.4 },
});
