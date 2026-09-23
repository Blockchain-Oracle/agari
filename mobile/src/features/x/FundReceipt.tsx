import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { X_GRANT } from "@agari/core/x";
import { StyleSheet, Text, View } from "react-native";
import { TRADE_FROM_X } from "@/features/x/copy";
import { Chips } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { AmountInput } from "../strategies/AmountInput";
import { ReviewGate } from "../strategies/ReviewGate";

const PRESETS = ["5", "10", "25"] as const;
const R = TRADE_FROM_X.receipt;

/**
 * web's features/x/CapabilityReceipt.tsx: the amount, what the executor CAN do (open a position you own from this
 * balance) and CANNOT (withdraw, transfer, drain), then the reviewed deposit-and-grant.
 */
export function FundReceipt({ amount, setAmount, disabled, depositing, firstTime, decimals, symbol, walletBase, onDeposit }: {
  amount: string;
  setAmount: (value: string) => void;
  disabled: boolean;
  depositing: boolean;
  firstTime: boolean;
  decimals: number;
  symbol: string;
  walletBase: bigint | null;
  onDeposit: (amountBase: bigint) => Promise<void>;
}) {
  const { color } = useTheme();
  const amountBase = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
  const shown = amountBase > 0n ? formatBaseUnits(amountBase, decimals) : "—";
  const [l1, l2, l3, l4, l5] = R.lede(shown, symbol);
  const [c1, c2, c3, c4, c5] = R.canText(shown, X_GRANT.openWindows);
  const strong = { color: color.ink, fontFamily: FONT.bodyStrong };
  const blocker = amountBase <= 0n ? "Enter an amount to fund." : walletBase !== null && amountBase > walletBase ? `Your wallet holds ${formatBaseUnits(walletBase, decimals)} ${symbol}.` : null;
  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>
        {l1}
        <Text style={strong}>{l2}</Text>
        {l3}
        <Text style={[strong, { color: color.accent }]}>{l4}</Text>
        {l5}
      </Text>
      <AmountInput label={R.amountAria} symbol={symbol} value={amount} onChange={setAmount} disabled={disabled} />
      <Chips options={PRESETS.map((p) => ({ value: p, label: `${p} ${symbol}` }))} value={amount} onPick={setAmount} />
      <View style={styles.ledger}>
        <View style={[styles.cell, { borderColor: color.profit, backgroundColor: color.profitWash }]}>
          <Text style={[TYPE.labelMicro, { color: color.profit }]}>{R.can}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {c1}
            <Text style={strong}>{c2}</Text>
            {c3}
            <Text style={strong}>{c4}</Text>
            {c5}
          </Text>
        </View>
        <View style={[styles.cell, { borderColor: color.loss, backgroundColor: color.lossWash }]}>
          <Text style={[TYPE.labelMicro, { color: color.loss }]}>{R.cannot}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            <Text style={styles.struck}>{R.cannotStruck}</Text>
            {R.cannotTail}
          </Text>
        </View>
      </View>
      <ReviewGate
        cta={depositing ? R.busy : firstTime ? R.ctaApprove : R.cta}
        title="Fund and enable X trading"
        lines={[
          { label: "Deposit from wallet", value: `${shown} ${symbol}` },
          { label: "Executor may", value: "open positions you own" },
          { label: "Executor may not", value: "withdraw · transfer", tone: "muted" },
          { label: "Open Windows", value: `up to ${X_GRANT.openWindows}` },
          { label: "Expires", value: `${X_GRANT.days} days · revocable` },
        ]}
        maxLoss={`${shown} ${symbol}`}
        confirmLabel="Slide to fund"
        busy={depositing}
        disabled={disabled}
        blocker={blocker}
        onConfirm={() => onDeposit(amountBase)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  ledger: { gap: 8 },
  cell: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 10, gap: 4 },
  struck: { textDecorationLine: "line-through" },
});
