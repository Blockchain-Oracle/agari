import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { pct, tokens, usd } from "@/features/desk/format";
import type { NativeDeskView as DeskView, NativeHolding as HoldingRow } from "../native-view";
import { EmptyState } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { Panel, segColor, Sparkline } from "../kit";

const K = COCKPIT.holdings;
const H = DESK.page.holdings;

/** Now against target as a bar with the target's tick. */
function WeightBar({ nowBps, targetBps, tint, nowText }: { nowBps: number; targetBps: number; tint: string; nowText: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.weight}>
      <View style={styles.weightLabels}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {K.now} <Text style={[TYPE.data, { color: color.ink }]}>{nowText}</Text>
        </Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {K.target} <Text style={[TYPE.data, { color: color.ink }]}>{pct(targetBps)}</Text>
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: color.surface2 }]}>
        <View style={[styles.fill, { width: `${Math.min(100, nowBps / 100)}%`, backgroundColor: tint }]} />
        <View style={[styles.tick, { left: `${Math.min(100, targetBps / 100)}%`, backgroundColor: color.ink }]} />
      </View>
    </View>
  );
}

/** One company (web's `HoldingCard`, 21st Asset Card #7945): mark, value, price line across checks, now vs target. */
function HoldingCard({ h }: { h: HoldingRow }) {
  const { color } = useTheme();
  const line = h.priceHistory;
  const tone = h.driftBps === 0 || h.standing === H.inLine ? "in" : h.driftBps > 0 ? "over" : "under";
  const chipInk = tone === "in" ? color.profit : tone === "over" ? color.warning : color.info;
  return (
    <Panel title={h.name} aside={<Text style={[TYPE.dataLg, { color: color.ink }]}>{h.valueE6 === null ? "—" : usd(h.valueE6)}</Text>}>
      <View style={styles.id}>
        <AssetDisc asset={h.symbol} size={36} />
        <Text style={[TYPE.data, styles.grow, { color: color.inkSecondary }]}>{K.tokens(tokens(h.raw), h.symbol)}</Text>
        {line.length >= 2 ? <Sparkline values={line} width={110} height={32} /> : null}
      </View>
      <WeightBar nowBps={h.weightBps} targetBps={h.targetBps} tint={segColor(h.symbol, color)} nowText={h.valueE6 === null ? "—" : pct(h.weightBps)} />
      <View style={styles.chips}>
        {h.valueE6 !== null ? (
          <View style={[styles.chip, { borderColor: chipInk }]}>
            <Text style={[TYPE.caption, { color: chipInk }]}>{h.standing}</Text>
          </View>
        ) : null}
        {h.premiumBps !== null ? (
          <View style={[styles.chip, { borderColor: h.premiumBps > 0 ? color.accent : color.hairline }]}>
            <Text style={[TYPE.caption, { color: h.premiumBps > 0 ? color.accent : color.inkSecondary }]}>{h.premiumBps >= 0 ? H.premium(pct(h.premiumBps)) : H.discount(pct(h.premiumBps))}</Text>
          </View>
        ) : null}
      </View>
      {h.flags.map((flag) => (
        <View key={flag} style={styles.flag}>
          <SymbolView name={{ ios: "exclamationmark.triangle", android: "warning" }} size={14} tintColor={color.warning} />
          <Text style={[TYPE.caption, styles.grow, { color: color.ink }]}>{flag}</Text>
        </View>
      ))}
    </Panel>
  );
}

/** The USDC the desk holds, as its own card. */
function CashCard({ view }: { view: DeskView }) {
  const { color } = useTheme();
  const C = DESK.page.cash;
  const total = view.plate.totalE6;
  const share = total && total > 0n ? Number((view.plate.cashE6 * 10_000n) / total) : null;
  const target = view.mandate?.targets.cashBps ?? 0;
  return (
    <Panel title={K.cashName} aside={<Text style={[TYPE.dataLg, { color: color.ink }]}>{usd(view.plate.cashE6)}</Text>}>
      <View style={styles.id}>
        <TUsdcMark size={36} />
        <Text style={[TYPE.data, styles.grow, { color: color.inkSecondary }]}>{K.cashTitle}</Text>
      </View>
      {share !== null ? <WeightBar nowBps={share} targetBps={target} tint={color.inkMuted} nowText={pct(share)} /> : null}
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{view.isLive ? C.line(usd(view.plate.cashE6)) : C.practiceLine(usd(view.plate.cashE6))}</Text>
    </Panel>
  );
}

/** The Holdings tab (web's HoldingsPanel.tsx `HoldingsTab`): a card per company held, then the cash. */
export function HoldingsTab({ view }: { view: DeskView }) {
  return (
    <View style={styles.tab}>
      {view.holdings.length === 0 ? <EmptyState why={H.title} detail={H.none} /> : view.holdings.map((h) => <HoldingCard key={h.symbol} h={h} />)}
      <CashCard view={view} />
    </View>
  );
}

const styles = StyleSheet.create({
  tab: { gap: 12 },
  id: { flexDirection: "row", alignItems: "center", gap: 10 },
  grow: { flex: 1 },
  weight: { gap: 6 },
  weightLabels: { flexDirection: "row", justifyContent: "space-between" },
  bar: { height: 8, borderRadius: RADIUS.full, overflow: "hidden" },
  fill: { height: 8 },
  tick: { position: "absolute", top: 0, width: 2, height: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 9, paddingVertical: 2 },
  flag: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
});
