import { CircleDollarSign, Layers, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { pct, tokens, usd } from "@/features/desk/format";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView, NativeHolding } from "../native-view";
import { brandColor, DT, EmptyState, FillSparkline, useDeskTheme } from "../kit";

const K = COCKPIT.holdings;

/** `.cp-weight`: now against target as a bar with the target's tick. */
function Weight({ nowText, targetText, nowBps, targetBps, fill }: { nowText: string; targetText: string; nowBps: number; targetBps: number; fill: string }) {
  const { color } = useDeskTheme();
  return (
    <View style={styles.weight}>
      <View style={styles.weightLabels}>
        <Text style={[styles.weightText, { color: color.inkSecondary }]}>
          <Text style={[DT.statLabel, { color: color.inkMuted }]}>{K.now}</Text> <Text style={[styles.b, { color: color.ink }]}>{nowText}</Text>
        </Text>
        <Text style={[styles.weightText, { color: color.inkSecondary }]}>
          <Text style={[DT.statLabel, { color: color.inkMuted }]}>{K.target}</Text> <Text style={[styles.b, { color: color.ink }]}>{targetText}</Text>
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: color.surface2 }]}>
        <View style={[styles.fill, { width: `${Math.min(100, nowBps / 100)}%`, backgroundColor: fill }]} />
        <View style={[styles.tick, { left: `${Math.min(100, targetBps / 100)}%`, backgroundColor: color.ink }]} />
      </View>
    </View>
  );
}

/** `.cp-card.cp-holding`: a 3 px brand strip on top, then the head (mark, name, tokens, value). */
function HoldingFrame({ index, brand, disc, name, sym, value, children }: { index: number; brand: string; disc: ReactNode; name: string; sym: string; value: string; children: ReactNode }) {
  const { color } = useDeskTheme();
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.duration(360).delay(index * 60).easing(Easing.bezier(0.22, 1, 0.36, 1))} style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={[styles.strip, { backgroundColor: brand }]} />
      <View style={styles.head}>
        {disc}
        <View style={styles.id}>
          <Text style={[styles.name, { color: color.ink }]}>{name}</Text>
          <Text style={[styles.sym, { color: color.inkMuted }]}>{sym}</Text>
        </View>
        <Text style={[styles.value, { color: color.ink }]}>{value}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

/** One company as 21st's Asset Card (#7945): its mark, value, the price across checks, now against target, flags. */
function HoldingCard({ h, index }: { h: NativeHolding; index: number }) {
  const { color, t } = useDeskTheme();
  const H = DESK.page.holdings;
  const brand = brandColor(h.symbol, color);
  const tone = h.driftBps === 0 || h.standing === H.inLine ? "in" : h.driftBps > 0 ? "over" : "under";
  const toneStyle = tone === "in" ? { color: color.profit, borderColor: t.chipIn } : { color: color.warning, borderColor: t.chipWarn };
  const accent = h.premiumBps !== null && h.premiumBps > 0;
  return (
    <HoldingFrame index={index} brand={brand} disc={<AssetDisc asset={h.symbol} size={44} />} name={h.name} sym={K.tokens(tokens(h.raw), h.symbol)} value={h.valueE6 === null ? "—" : usd(h.valueE6)}>
      <View accessibilityLabel={K.week}>
        <FillSparkline values={h.priceHistory} height={44} />
      </View>
      <Weight nowText={h.valueE6 === null ? "—" : pct(h.weightBps)} targetText={pct(h.targetBps)} nowBps={h.weightBps} targetBps={h.targetBps} fill={brand} />
      <View style={styles.chips}>
        {h.valueE6 !== null ? <Text style={[styles.chip, { color: toneStyle.color, borderColor: toneStyle.borderColor }]}>{h.standing}</Text> : null}
        {h.premiumBps !== null ? (
          <Text style={[styles.chip, accent ? { color: color.accent, borderColor: color.accentDim, backgroundColor: color.accentWash } : { color: color.inkSecondary, borderColor: color.hairline }]}>
            {h.premiumBps >= 0 ? H.premium(pct(h.premiumBps)) : H.discount(pct(h.premiumBps))}
          </Text>
        ) : null}
      </View>
      {h.flags.map((flag) => (
        <View key={flag} style={[styles.flag, { backgroundColor: t.warnWash }]}>
          <TriangleAlert size={15} color={color.warning} style={styles.flagIcon} />
          <Text style={[styles.flagText, { color: color.warning }]}>{flag}</Text>
        </View>
      ))}
    </HoldingFrame>
  );
}

/** Item 5: the USDC the desk holds, as its own card. */
function CashCard({ view, index }: { view: DeskView; index: number }) {
  const { color, t } = useDeskTheme();
  const C = DESK.page.cash;
  const total = view.plate.totalE6;
  const share = total && total > 0n ? Number((view.plate.cashE6 * 10_000n) / total) : null;
  const target = view.mandate?.targets.cashBps ?? 0;
  const disc = (
    <View style={[styles.usdc, { backgroundColor: t.usdcWash }]}>
      <CircleDollarSign size={24} color={color.markUsdc} />
    </View>
  );
  return (
    <HoldingFrame index={index} brand={color.inkMuted} disc={disc} name={K.cashName} sym={K.cashTitle} value={usd(view.plate.cashE6)}>
      {share !== null ? <Weight nowText={pct(share)} targetText={pct(target)} nowBps={share} targetBps={target} fill={color.inkMuted} /> : null}
      <Text style={[DT.caption, { color: color.inkSecondary }]}>{view.isLive ? C.line(usd(view.plate.cashE6)) : C.practiceLine(usd(view.plate.cashE6))}</Text>
    </HoldingFrame>
  );
}

/** web's HoldingsPanel.tsx `HoldingsTab`: a card per company held, then the cash; one column at phone width. */
export function HoldingsTab({ view }: { view: DeskView }) {
  const H = DESK.page.holdings;
  return (
    <View style={styles.list}>
      {view.holdings.length === 0 ? <EmptyState icon={Layers} title={H.title} body={H.none} /> : view.holdings.map((h, i) => <HoldingCard key={h.symbol} h={h} index={i} />)}
      <CashCard view={view} index={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  card: { gap: 14, padding: 16, borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  strip: { position: "absolute", top: 0, left: 0, right: 0, height: 3, opacity: 0.85 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  id: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6 },
  sym: { fontFamily: FONT.body, fontSize: 11.5, lineHeight: 18.4 },
  value: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 32, fontVariant: ["tabular-nums"] },
  usdc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  weight: { gap: 6 },
  weightLabels: { flexDirection: "row", justifyContent: "space-between" },
  weightText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  b: { fontFamily: FONT.bodyStrong },
  bar: { height: 8, borderRadius: 9999 },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, borderRadius: 9999 },
  tick: { position: "absolute", top: -4, width: 2, height: 16, borderRadius: 1, marginLeft: -1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 9999, borderWidth: 1, overflow: "hidden", fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  flag: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  flagIcon: { marginTop: 1 },
  flagText: { flex: 1, fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18.125 },
});
