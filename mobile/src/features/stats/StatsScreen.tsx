import { formatBaseUnits } from "@agari/core/units";
import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { ago, fmtCount, STATS } from "@/features/stats/copy";
import { TRACTION_KEY, useTraction } from "@/features/stats/useTraction";
import { CONTAINER_GUTTER, ExplorePage } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { statsTokens } from "~/theme/web/explore/stats";
import { ActivityList } from "./ActivityList";
import { GrowthCurve } from "./GrowthCurve";
import { StatsHero } from "./StatsHero";
import { SectionHead, Stat } from "./StatsSections";

/**
 * `/stats` — web's StatsPage (features/stats/StatsPage.tsx) as a phone draws it: the page hero and its headline card,
 * then 01 Growth (the curve card), 02 Adoption (four stacked stat cards and the attribution note), 03 Live activity
 * and the foot. One read of `/api/traction`, polled every 30 s; pull to refresh re-reads it.
 */
export function StatsScreen() {
  const { name, color } = useTheme();
  const tk = statsTokens(name);
  const client = useQueryClient();
  const reading = useTraction();
  const nowMs = useChainNowMs();
  const t = reading?.ok ? reading.value : null;
  const failed = reading !== null && !reading.ok;

  return (
    <ExplorePage title={STATS.title} onRefresh={() => client.invalidateQueries({ queryKey: TRACTION_KEY })}>
      <StatsHero wallets={t ? fmtCount(t.wallets) : "—"} calls={t ? fmtCount(t.calls) : "—"} />
      <View style={styles.main}>
        {!t && !failed ? <Text style={[styles.state, { color: color.inkMuted }]}>{STATS.reading}</Text> : null}
        {failed ? <Text style={[styles.state, { color: color.loss }]}>{STATS.unreachable}</Text> : null}
        {t ? (
          <>
            <SectionHead {...STATS.sections.growth} />
            <LinearGradient colors={[tk.cardTop, tk.card]} style={[styles.curveCard, { borderColor: tk.hairline }]}>
              <GrowthCurve points={t.curve} />
            </LinearGradient>

            <SectionHead {...STATS.sections.adoption} />
            <View style={styles.grid}>
              <Stat label={STATS.stats.wallets.label} value={fmtCount(t.wallets)} sub={STATS.stats.wallets.sub} accent />
              <Stat label={STATS.stats.calls.label} value={fmtCount(t.calls)} sub={STATS.stats.calls.sub} />
              <Stat
                label={STATS.stats.staked.label}
                value={formatBaseUnits(t.stakedBase, t.meta.decimals)}
                sub={t.meta.complete ? STATS.stats.staked.onLine(t.meta.symbol) : STATS.stats.staked.floor(t.meta.symbol)}
              />
              <Stat label={STATS.stats.settled.label} value={fmtCount(t.settledWindows)} sub={STATS.stats.settled.sub(t.windows)} />
            </View>
            <Text style={[styles.note, { color: color.inkDisabled }]}>
              {STATS.attribution(t.unattributed)}
              {t.meta.complete ? "" : ` ${STATS.floor}`}
            </Text>

            <SectionHead
              {...STATS.sections.activity}
              right={<Text style={[styles.updated, { color: color.inkDisabled }]}>{STATS.activity.updated(ago(t.meta.computedAtMs, nowMs))}</Text>}
            />
            <ActivityList events={t.recent} decimals={t.meta.decimals} symbol={t.meta.symbol} nowMs={nowMs} />
            <Text style={[styles.foot, { color: color.inkDisabled }]}>{STATS.foot}</Text>
          </>
        ) : null}
      </View>
      <View style={[styles.pageRule, { backgroundColor: tk.pageRule }]} />
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  // .stats-main's 48 below, then .stats's own 64 and its bottom rule.
  main: { paddingBottom: 48 + 64 },
  pageRule: { height: 1, marginHorizontal: -CONTAINER_GUTTER },
  state: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4, paddingVertical: 80, textAlign: "center" },
  curveCard: { borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 40 },
  grid: { gap: 12, marginBottom: 16 },
  note: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.875, marginBottom: 40 },
  updated: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  foot: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.875, marginTop: 20 },
});
