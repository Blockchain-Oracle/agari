import { FEE_RESERVE_LAMPORTS } from "@agari/core/constants";
import type { BalanceSheet } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PLATE } from "@/features/markets/portfolio/plate/copy";
import type { Pool, PoolId } from "@/features/markets/portfolio/plate/useMoney";
import { BALANCE } from "@/lib/copy";
import { FONT, TYPE, useTheme } from "~/theme";
import { Disclosure } from "./Disclosure";
import { fmt2 } from "./format";
import { usePlateInk } from "./usePlateInk";

/** The cluster's native currency: SOL, 9 decimals (web `BalanceSheetPanel` NATIVE, shown to 4 places). */
const SOL_DECIMALS = 9;
const GAS_DP = 4;

interface PoolLineProps {
  label: string;
  note?: string;
  blocked?: string | null;
  action?: string | null;
  /** Already formatted; "—" where the pool is unread, never a fake 0.00. */
  amount: string;
  unit: string;
  warning?: boolean;
}

/** One pool — label, the sentence saying what it is for and who can move it, then the amount (web `PoolRows` Body). */
export function PoolLine({ label, note, blocked, action, amount, unit, warning }: PoolLineProps) {
  const ink = usePlateInk();
  const { color } = useTheme();
  return (
    <View style={styles.body} accessible accessibilityLabel={`${label}: ${amount} ${unit}. ${note ?? ""}`}>
      <View style={styles.text}>
        <Text style={[styles.label, { color: ink.ink }]}>{label}</Text>
        {blocked ? <Text style={[styles.small, { color: ink.mute }]}>{blocked}</Text> : null}
        {note ? <Text style={[styles.small, { color: warning ? color.warning : ink.mute }]}>{note}</Text> : null}
        {action ? <Text style={[styles.action, { color: color.accent, borderColor: color.accentDim }]}>{action}</Text> : null}
      </View>
      <Text style={[styles.amount, { color: warning ? color.warning : ink.ink }]}>
        {amount}
        <Text style={[styles.unit, { color: ink.mute }]}> {unit}</Text>
      </Text>
    </View>
  );
}

interface PoolRowsProps {
  pools: readonly Pool[];
  sheet: BalanceSheet | null;
  decimals: number;
  symbol: string;
  /** Controls that belong to a pool, revealed by tapping that pool's own row. */
  panels?: Partial<Record<PoolId, ReactNode>>;
}

/**
 * web `PoolRows` + the balance sheet's own rows (`BalanceSheetPanel`): every other place the wallet's money sits, as
 * rows and never merged into the figure above — the X balance, the private balance, cash locked by resting orders,
 * venue payout credit, and the SOL that pays fees.
 */
export function PoolRows({ pools, sheet, decimals, symbol, panels = {} }: PoolRowsProps) {
  const ink = usePlateInk();
  const gasLow = sheet !== null && sheet.nativeLamports < FEE_RESERVE_LAMPORTS;
  const line = (child: ReactNode, key: string) => (
    <View key={key} style={[styles.line, { borderBottomColor: ink.line }]}>
      {child}
    </View>
  );

  return (
    <View style={[styles.rows, { borderTopColor: ink.line }]}>
      <Text style={[styles.eyebrow, { color: ink.mute }]}>{PLATE.poolsEyebrow}</Text>
      {pools.map((pool) => {
        const amount = pool.amountBase === null ? "—" : fmt2(pool.amountBase, decimals);
        const panel = panels[pool.id];
        const summary = (
          <PoolLine
            label={pool.label}
            note={pool.note}
            blocked={pool.blockedReason}
            action={panel && !pool.blockedReason ? pool.action?.label : null}
            amount={amount}
            unit={symbol}
          />
        );
        if (!panel) return line(summary, pool.id);
        return line(
          <Disclosure summary={summary} accessibilityLabel={`${pool.label}, ${amount} ${symbol}`} ink={ink.mute}>
            {panel}
          </Disclosure>,
          pool.id,
        );
      })}
      {sheet
        ? line(
            <PoolLine
              label={BALANCE.rows.escrow}
              note={sheet.orderEscrowBase > 0n ? BALANCE.escrowNote : undefined}
              amount={fmt2(sheet.orderEscrowBase, sheet.decimals)}
              unit={symbol}
            />,
            "escrow",
          )
        : null}
      {sheet && sheet.venueCreditBase > 0n
        ? line(
            <PoolLine label={BALANCE.rows.credit} note={BALANCE.creditFirst} amount={fmt2(sheet.venueCreditBase, sheet.decimals)} unit={symbol} />,
            "credit",
          )
        : null}
      {sheet
        ? line(
            <PoolLine
              label={BALANCE.rows.gas}
              note={gasLow ? BALANCE.gasLow : undefined}
              warning={gasLow}
              amount={formatBaseUnits(sheet.nativeLamports, SOL_DECIMALS, { maxDp: GAS_DP })}
              unit="SOL"
            />,
            "gas",
          )
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 14 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 2 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14, paddingVertical: 10 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  label: { fontFamily: FONT.heading, fontSize: 14 },
  small: { ...TYPE.caption, fontSize: 12, lineHeight: 16 },
  action: { alignSelf: "flex-start", marginTop: 6, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, fontFamily: FONT.bodyStrong, fontSize: 12, overflow: "hidden" },
  amount: { fontFamily: FONT.data, fontSize: 17, fontVariant: ["tabular-nums"] },
  unit: { fontSize: 10 },
});
