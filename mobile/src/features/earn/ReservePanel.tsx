import type { ReserveSheet } from "@agari/core/reserves";
import { oneUnit } from "@agari/core/units";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { EARN } from "@/features/earn/copy";
import { formatSharePrice, money2, sharePriceDeltaPct, utilizationPct } from "@/features/earn/format";
import type { ReserveWords } from "@/features/earn/reserves";
import { FONT } from "~/theme";
import { useEarnParlay } from "./EarnKit";

interface ReservePanelProps {
  sheet: ReserveSheet | null;
  symbol: string;
  words: ReserveWords;
  /** The maker vault's extra state: quoting is off without a maker key, whatever the sheet says. */
  status?: string;
}

/**
 * web's `features/earn/ReservePanel.tsx` (`.earn-vault.ea-panel`): the tab's tags, the share price as the hero number
 * with its delta chip above par, the since-launch line, then reserve value and utilization with its meter.
 */
export function ReservePanel({ sheet, symbol, words, status }: ReservePanelProps) {
  const { color, t } = useEarnParlay();
  const { panel } = EARN;
  const frame = (children: React.ReactNode) => (
    <View style={[styles.panel, { borderColor: t.panelBorder, boxShadow: t.panelShadow }]}>
      <LinearGradient colors={[t.panelFrom, t.panelTo]} start={{ x: 0.31, y: 0 }} end={{ x: 0.69, y: 1 }} style={[StyleSheet.absoluteFill, styles.wash]} />
      <View style={[styles.accent, { backgroundColor: t.brandVermilion }]} />
      {children}
    </View>
  );
  if (!sheet) return frame(<Text style={[styles.loading, { color: color.inkMuted }]}>{panel.loading}</Text>);

  const one = oneUnit(sheet.decimals);
  const delta = sharePriceDeltaPct(sheet.sharePriceRaw, one);
  const below = sheet.supplyShares > 0n && sheet.sharePriceRaw < one;
  const fill = Math.min(100, sheet.utilizationBps / 100);
  return frame(
    <>
      <View style={styles.head}>
        <Text style={[styles.tag, { color: color.inkMuted }]}>{status ?? (sheet.paused ? words.paused : words.live)}</Text>
        <Text style={[styles.tag, styles.tagBrand, { color: color.inkMuted }]}>{words.brand}</Text>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.price}>
          <Text style={[styles.priceText, { color: color.ink }]}>{formatSharePrice(sheet.sharePriceRaw, sheet.decimals)}</Text>
          <Text style={[styles.priceUnit, { color: color.inkMuted }]}>{panel.perShare}</Text>
        </View>
        {delta ? (
          <View style={[styles.chip, { backgroundColor: t.chipgBg, borderColor: t.chipgBorder }]}>
            <Svg width={8} height={8} viewBox="0 0 8 8">
              <Path d="M4 0 L8 7 L0 7 Z" fill={color.profit} />
            </Svg>
            <Text style={[styles.chipText, { color: color.profit }]}>{delta}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.since, { color: color.inkMuted }]}>{below ? panel.belowLaunch(words.noun) : panel.sinceLaunch}</Text>

      <View style={[styles.hair, { backgroundColor: t.hair }]} />

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={[styles.k, { color: color.inkMuted }]}>{words.valueLabel}</Text>
          <Text style={[styles.v, { color: color.ink }]}>
            {money2(sheet.totalValueBase, sheet.decimals)} <Text style={[styles.vUnit, { color: color.inkMuted }]}>{symbol}</Text>
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.k, { color: color.inkMuted }]}>{panel.utilization}</Text>
          <Text style={[styles.v, styles.vAccent, { color: color.accent }]}>{utilizationPct(sheet.utilizationBps)}</Text>
          <View style={[styles.meter, { backgroundColor: t.meterTrack }]}>
            <LinearGradient
              colors={[t.brandVermilion, t.meterTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.meterFill, { width: fill > 0 ? `${fill}%` : 4, minWidth: 4, boxShadow: t.meterGlow }]}
            />
          </View>
        </View>
      </View>
    </>,
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  wash: { borderRadius: 19 },
  accent: { position: "absolute", top: 0, left: 26, width: 46, height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, opacity: 0.9 },
  loading: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16, paddingVertical: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  tag: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  tagBrand: { letterSpacing: 1.8 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  price: { flexDirection: "row", alignItems: "baseline" },
  priceText: { fontFamily: FONT.headingHeavy, fontSize: 42, lineHeight: 42, marginVertical: -2.5, letterSpacing: -1.05, fontVariant: ["tabular-nums"] },
  priceUnit: { marginLeft: 4, fontFamily: FONT.dataRegular, fontSize: 13.5, lineHeight: 18 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 4, borderRadius: 9999, borderWidth: 1 },
  chipText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  since: { marginTop: 10, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.76, textTransform: "uppercase" },
  hair: { height: 1, marginVertical: 24 },
  metrics: { flexDirection: "row", gap: 20 },
  metric: { flex: 1, minWidth: 0 },
  k: { marginBottom: 6, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.62, textTransform: "uppercase" },
  v: { fontFamily: FONT.dataRegular, fontSize: 15, lineHeight: 24, fontVariant: ["tabular-nums"] },
  vAccent: { marginBottom: 8 },
  vUnit: { fontSize: 12 },
  meter: { height: 5, borderRadius: 3, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 3 },
});
