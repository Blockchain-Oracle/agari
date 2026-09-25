import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PLATE } from "@/features/markets/portfolio/plate/copy";
import type { Money } from "@/features/markets/portfolio/plate/useMoney";
import { PillButton } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { fmt2 } from "./format";
import { usePlateInk } from "./usePlateInk";

/** yosuku `.ledger-plate::before`: a 4 px band of 2 px ticks every 10 px across the plate's top edge. */
export function PlateTicks({ color }: { color: string }) {
  return (
    <View style={styles.ticks} pointerEvents="none">
      {Array.from({ length: 80 }, (_, i) => (
        <View key={i} style={[styles.tick, { backgroundColor: color }]} />
      ))}
    </View>
  );
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

interface LedgerPlateProps {
  money: Money;
  symbol: string;
  openBets: number;
  settled: number;
  onPrimary: () => void;
  /** The pool rows and the Trading Balance disclosure: the account is the parent, they are its children. */
  children?: ReactNode;
}

/**
 * web `LedgerPlate` + ledger-plate.css at 402 px (`.ledger-plate` 16/14, radius 5, the tick band): "Ready to bet", the
 * vermilion figure, the whole amount when some sits elsewhere, the full-width pill, the two-segment bar and its legs.
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
    <View style={[styles.plate, { backgroundColor: ink.paper }]}>
      <PlateTicks color={ink.line} />
      <View style={styles.top}>
        <View>
          <Text style={[styles.eyebrow, { color: ink.mute }]}>{PLATE.eyebrow}</Text>
          <View style={styles.figureRow} accessible accessibilityLabel={`${PLATE.eyebrow}: ${figure} ${symbol}`}>
            <Text style={[styles.figure, { color: ink.figure }, !money.totalReady && styles.pending]}>{figure}</Text>
            <Text style={[styles.unit, { color: ink.mute }]}>{symbol}</Text>
          </View>
          {elsewhere > 0n ? (
            <Text style={[styles.elsewhere, { color: ink.mute }]}>
              <Text style={[styles.tab, { color: ink.ink }]}>{fmt2(money.readyToBetBase + elsewhere, decimals)}</Text> {PLATE.yours}
              {" · "}
              <Text style={[styles.tab, { color: ink.ink }]}>{fmt2(elsewhere, decimals)}</Text> {PLATE.elsewhere}
            </Text>
          ) : null}
        </View>
        <PillButton label={empty ? PLATE.getTest : PLATE.addMoney} onPress={onPrimary} block />
      </View>

      <View style={styles.split} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.bar, { backgroundColor: ink.line }]}>
          <View style={{ width: `${walletPct}%`, backgroundColor: ink.wallet }} />
          <View style={{ width: `${100 - walletPct}%`, backgroundColor: ink.account }} />
        </View>
      </View>
      <View style={styles.legs}>
        <Leg dot={ink.wallet} label={PLATE.inWallet} value={fmt2(money.walletBase, decimals)} />
        <Leg dot={ink.account} label={PLATE.inAccount} value={fmt2(money.accountBase, decimals)} />
        <Text style={[styles.counts, { color: ink.mute }]}>
          <Text style={[styles.tab, { color: ink.ink }]}>{openBets}</Text> {PLATE.open} <Text style={{ color: ink.line }}>·</Text>{" "}
          <Text style={[styles.tab, { color: ink.ink }]}>{settled}</Text> {PLATE.settled}
        </Text>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: 5, paddingVertical: 16, paddingHorizontal: 14, overflow: "hidden" },
  ticks: { position: "absolute", top: 0, left: 0, right: 0, height: 4, flexDirection: "row", overflow: "hidden" },
  tick: { width: 2, height: 4, marginLeft: 8 },
  top: { gap: 16 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  figureRow: { marginTop: 4, flexDirection: "row", alignItems: "baseline", gap: 8 },
  figure: { fontFamily: FONT.headingHeavy, fontSize: 32, lineHeight: 34, fontVariant: ["tabular-nums"] },
  pending: { opacity: 0.55 },
  unit: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  elsewhere: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  tab: { fontVariant: ["tabular-nums"] },
  split: { marginTop: 16 },
  bar: { flexDirection: "row", height: 6, borderRadius: 999, overflow: "hidden" },
  legs: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", columnGap: 32, rowGap: 4 },
  leg: { flexDirection: "row", alignItems: "center", gap: 8 },
  legDot: { width: 8, height: 8, borderRadius: 999 },
  legLabel: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  legValue: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8, fontVariant: ["tabular-nums"] },
  counts: { marginLeft: "auto", fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
});
