import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PLATE } from "@/features/markets/portfolio/plate/copy";
import type { Pool, PoolId } from "@/features/markets/portfolio/plate/useMoney";
import { usePortfolioTokens } from "~/components/portfolio/web";
import { FONT } from "~/theme";
import { Disclosure } from "./Disclosure";
import { fmt2 } from "./format";
import { go } from "./go";
import { usePlateInk } from "./usePlateInk";

/** `.pool-action`: rounded-md, a 45 % vermilion hairline, 11 px bold vermilion. */
function PoolAction({ label }: { label: string }) {
  const t = usePortfolioTokens();
  return <Text style={[styles.action, { color: t.vermilion, borderColor: t.actionBorder }]}>{label}</Text>;
}

/** web `PoolRows` Body: label (and why it is blocked), the note, then the amount — the amount IS the row. */
function Body({ pool, decimals, symbol, disclosureAction }: { pool: Pool; decimals: number; symbol: string; disclosureAction?: string }) {
  const ink = usePlateInk();
  return (
    <View style={styles.body}>
      <View style={styles.text}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: ink.ink }]}>{pool.label}</Text>
          {pool.blockedReason ? <Text style={[styles.blocked, { color: ink.mute }]}>{pool.blockedReason}</Text> : null}
        </View>
        <Text style={[styles.note, { color: ink.mute }]}>{pool.note}</Text>
        {disclosureAction ? (
          <View style={styles.summaryAction}>
            <PoolAction label={disclosureAction} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: ink.ink }]}>
        {pool.amountBase === null ? "—" : fmt2(pool.amountBase, decimals)}
        <Text style={[styles.unit, { color: ink.mute }]}> {symbol}</Text>
      </Text>
    </View>
  );
}

interface PoolRowsProps {
  pools: readonly Pool[];
  decimals: number;
  symbol: string;
  /** Controls that belong to a pool, revealed by tapping that pool's own row. */
  panels?: Partial<Record<PoolId, ReactNode>>;
}

/** web `PoolRows` (ledger-plate.css `.pool-*`): the other places your money is — rows, never merged into the figure. */
export function PoolRows({ pools, decimals, symbol, panels = {} }: PoolRowsProps) {
  const ink = usePlateInk();
  if (!pools.length) return null;
  return (
    <View style={[styles.rows, { borderTopColor: ink.line }]}>
      <Text style={[styles.eyebrow, { color: ink.mute }]}>{PLATE.poolsEyebrow}</Text>
      <View style={styles.list}>
        {pools.map((pool, i) => {
          const panel = panels[pool.id];
          const last = i === pools.length - 1;
          const line = [styles.line, { borderBottomColor: ink.line }, last && styles.lastLine];
          if (!panel) {
            const action = pool.action && !pool.blockedReason ? pool.action : null;
            return (
              <View key={pool.id} style={line}>
                <Body pool={pool} decimals={decimals} symbol={symbol} />
                {action ? (
                  <Pressable onPress={() => go(action.href)} accessibilityRole="link" accessibilityLabel={`${action.label} ${pool.label}`} style={styles.actionLink}>
                    <PoolAction label={action.label} />
                  </Pressable>
                ) : null}
              </View>
            );
          }
          const amount = pool.amountBase === null ? "—" : fmt2(pool.amountBase, decimals);
          return (
            <View key={pool.id} style={line}>
              <Disclosure
                accessibilityLabel={`${pool.label}, ${amount} ${symbol}`}
                ink={ink.mute}
                summary={<Body pool={pool} decimals={decimals} symbol={symbol} disclosureAction={!pool.blockedReason ? pool.action?.label : undefined} />}
                panelStyle={[styles.panel, { backgroundColor: ink.paper }]}
              >
                {panel}
              </Disclosure>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: 24, borderTopWidth: 1, paddingTop: 16 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  list: { marginTop: 4 },
  line: { borderBottomWidth: 1 },
  lastLine: { borderBottomWidth: 0 },
  body: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 16, rowGap: 4, paddingVertical: 10 },
  text: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 },
  label: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  blocked: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  note: { marginTop: 2, fontFamily: FONT.body, fontSize: 11, lineHeight: 15.1 },
  summaryAction: { marginTop: 8, flexDirection: "row" },
  actionLink: { flexDirection: "row", marginBottom: 12 },
  action: { borderRadius: 6, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 10, fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 17.6, overflow: "hidden" },
  amount: { flexShrink: 0, fontFamily: FONT.dataRegular, fontSize: 18, lineHeight: 28.8, fontVariant: ["tabular-nums"] },
  unit: { fontSize: 10 },
  panel: { paddingBottom: 16 },
});
