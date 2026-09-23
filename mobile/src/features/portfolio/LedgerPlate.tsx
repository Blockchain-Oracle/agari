import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PLATE } from "@/features/markets/portfolio/plate/copy";
import type { Money } from "@/features/markets/portfolio/plate/useMoney";
import { Button } from "~/components/kit";
import { FONT, RADIUS, TYPE } from "~/theme";
import { fmt2 } from "./format";
import { usePlateInk } from "./usePlateInk";

interface LedgerPlateProps {
  money: Money;
  symbol: string;
  openBets: number;
  settled: number;
  onPrimary: () => void;
  /** The pool rows and the Trading Balance disclosure: the account is the parent, they are its children. */
  children?: ReactNode;
}

/** One leg of the balance, tied to its bar segment by colour so the bar needs no legend of its own. */
function Leg({ dot, label, value }: { dot: string; label: string; value: string }) {
  const ink = usePlateInk();
  return (
    <View style={styles.leg} accessible accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.legDot, { backgroundColor: dot }]} />
      <Text style={[styles.legLabel, { color: ink.mute }]}>{label}</Text>
      <Text style={[styles.legValue, { color: ink.ink }]}>{value}</Text>
    </View>
  );
}

/**
 * web `LedgerPlate` (reference `portfolio/BalancePlate.tsx`): the one thing a person opens Portfolio to find out —
 * how much can I bet, right now. Wallet plus Trading Balance, because a bet routes to either; every pool that is NOT
 * spendable here is a row inside the plate, never merged into the figure. The primary opens the Add-money sheet.
 */
export function LedgerPlate({ money, symbol, openBets, settled, onPrimary, children }: LedgerPlateProps) {
  const ink = usePlateInk();
  const { decimals } = money;
  const empty = money.walletBase === 0n && money.accountBase === 0n;
  const total = money.walletBase + money.accountBase;
  const walletPct = total > 0n ? Number((money.walletBase * 100n) / total) : 0;
  const elsewhere = money.pools.reduce((sum, pool) => sum + (pool.amountBase ?? 0n), 0n);
  const figure = money.totalUnknown ? "0.00" : fmt2(money.readyToBetBase, decimals);

  return (
    <View style={[styles.plate, { backgroundColor: ink.paper, borderColor: ink.line }]}>
      <Text style={[styles.eyebrow, { color: ink.mute }]}>{PLATE.eyebrow}</Text>
      <View style={styles.figureRow} accessible accessibilityLabel={`${PLATE.eyebrow}: ${figure} ${symbol}`}>
        <Text style={[styles.figure, { color: ink.figure, opacity: money.totalReady ? 1 : 0.55 }]} adjustsFontSizeToFit numberOfLines={1}>
          {figure}
        </Text>
        <Text style={[styles.unit, { color: ink.mute }]}>{symbol}</Text>
      </View>
      {elsewhere > 0n ? (
        <Text style={[styles.elsewhere, { color: ink.mute }]}>
          <Text style={{ color: ink.ink }}>{fmt2(money.readyToBetBase + elsewhere, decimals)}</Text> {PLATE.yours}
          {" · "}
          <Text style={{ color: ink.ink }}>{fmt2(elsewhere, decimals)}</Text> {PLATE.elsewhere}
        </Text>
      ) : null}

      <Button label={empty ? PLATE.getTest : PLATE.addMoney} onPress={onPrimary} icon={{ ios: "plus", android: "add" }} />

      <View style={[styles.bar, { backgroundColor: ink.line }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: `${walletPct}%`, backgroundColor: ink.wallet }} />
        <View style={{ width: `${total > 0n ? 100 - walletPct : 0}%`, backgroundColor: ink.account }} />
      </View>
      <View style={styles.legs}>
        <Leg dot={ink.wallet} label={PLATE.inWallet} value={fmt2(money.walletBase, decimals)} />
        <Leg dot={ink.account} label={PLATE.inAccount} value={fmt2(money.accountBase, decimals)} />
        <Text style={[styles.counts, { color: ink.mute }]}>
          <Text style={{ color: ink.ink }}>{openBets}</Text> {PLATE.open}
          <Text style={{ color: ink.line }}> · </Text>
          <Text style={{ color: ink.ink }}>{settled}</Text> {PLATE.settled}
        </Text>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 12 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase" },
  figureRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  figure: { fontFamily: FONT.headingHeavy, fontSize: 40, lineHeight: 44, fontVariant: ["tabular-nums"], flexShrink: 1 },
  unit: { fontFamily: FONT.data, fontSize: 14 },
  elsewhere: { ...TYPE.data, fontSize: 12, marginTop: -6 },
  bar: { flexDirection: "row", height: 6, borderRadius: RADIUS.full, overflow: "hidden", marginTop: 4 },
  legs: { gap: 6 },
  leg: { flexDirection: "row", alignItems: "center", gap: 8 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legLabel: { fontFamily: FONT.body, fontSize: 13, flex: 1 },
  legValue: { fontFamily: FONT.data, fontSize: 14, fontVariant: ["tabular-nums"] },
  counts: { fontFamily: FONT.data, fontSize: 12 },
});
