import type { ReserveSheet } from "@agari/core/reserves";
import { oneUnit } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { EARN } from "@/features/earn/copy";
import { formatSharePrice, money2, sharePriceDeltaPct, utilizationPct } from "@/features/earn/format";
import type { ReserveWords } from "@/features/earn/reserves";
import { LoadingState, Pill } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";

const P = EARN.panel;

/**
 * web's `features/earn/ReservePanel.tsx`: the share price as the hero number, the delta chip above par, the
 * reserve's value and utilization with its meter. Every number is the live account, or the panel says it is reading.
 */
export function ReservePanel({ sheet, symbol, words, status }: { sheet: ReserveSheet | null; symbol: string; words: ReserveWords; status?: string }) {
  const { color } = useTheme();
  if (!sheet) {
    return (
      <View style={[styles.panel, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <View style={[styles.accent, { backgroundColor: color.accent }]} />
        <LoadingState shape="plate" label={P.loading} />
      </View>
    );
  }
  const delta = sharePriceDeltaPct(sheet.sharePriceRaw, oneUnit(sheet.decimals));
  const below = sheet.supplyShares > 0n && sheet.sharePriceRaw < oneUnit(sheet.decimals);
  const fill = Math.min(100, sheet.utilizationBps / 100);
  return (
    <View style={[styles.panel, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={[styles.accent, { backgroundColor: color.accent }]} />
      <View style={styles.tags}>
        <Pill label={status ?? (sheet.paused ? words.paused : words.live)} tone={sheet.paused || status ? "warning" : "profit"} dot />
        <Pill label={words.brand} tone="accent" />
      </View>
      <View style={styles.priceRow}>
        <Text style={[TYPE.dataHero, { color: color.ink }]}>{formatSharePrice(sheet.sharePriceRaw, sheet.decimals)}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{P.perShare}</Text>
        {delta ? <Pill label={`+${delta}`} tone="profit" /> : null}
      </View>
      <Text style={[TYPE.caption, { color: below ? color.loss : color.inkSecondary }]}>{below ? P.belowLaunch(words.noun) : P.sinceLaunch}</Text>
      <View style={[styles.hair, { backgroundColor: color.hairline }]} />
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{words.valueLabel}</Text>
          <Text style={[TYPE.data, { color: color.ink }]}>
            {money2(sheet.totalValueBase, sheet.decimals)} <Text style={{ color: color.inkMuted }}>{symbol}</Text>
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{P.utilization}</Text>
          <Text style={[TYPE.data, { color: color.accent }]}>{utilizationPct(sheet.utilizationBps)}</Text>
          <View
            style={[styles.meter, { backgroundColor: color.surface2 }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(fill) }}
          >
            <View style={[styles.meterFill, { width: `${fill}%`, backgroundColor: color.accent }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, paddingTop: 20, gap: 8, overflow: "hidden" },
  accent: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  tags: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  hair: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  metrics: { flexDirection: "row", gap: 16 },
  metric: { flex: 1, gap: 4 },
  meter: { height: 4, borderRadius: RADIUS.full, overflow: "hidden" },
  meterFill: { height: 4 },
});
