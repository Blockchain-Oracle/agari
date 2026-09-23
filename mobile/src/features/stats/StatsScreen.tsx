import { formatBaseUnits } from "@agari/core/units";
import { useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { ago, fmtCount, STATS } from "@/features/stats/copy";
import { TRACTION_KEY, useTraction } from "@/features/stats/useTraction";
import { Card, ErrorState, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { LiveDot } from "~/features/activity/LiveDot";
import { FONT, TYPE, useTheme } from "~/theme";
import { GrowthCurve } from "./GrowthCurve";
import { StatTile } from "./StatTile";
import { TractionTape } from "./TractionTape";

/** The headline card: wallets that made a call in the last day, and the calls filled under it. */
function Headline({ wallets, calls }: { wallets: string; calls: string }) {
  const { color } = useTheme();
  const words = STATS.hero;
  return (
    <Card tone="cream">
      <View style={styles.headEyebrow}>
        <LiveDot size={7} />
        <Text style={[styles.eyebrow, { color: color.creamInk }]}>{words.headline.toUpperCase()}</Text>
      </View>
      <Text style={[TYPE.dataHero, styles.big, { color: color.creamInk }]} accessibilityLabel={`${words.headline}: ${wallets}`}>
        {wallets}
      </Text>
      <Text style={[TYPE.caption, { color: color.creamInk }]}>{words.headlineCaption}</Text>
      <View style={[styles.foot, { borderTopColor: color.creamHairline }]}>
        <Text style={[TYPE.caption, { color: color.creamInk }]}>{words.headlineFoot}</Text>
        <Text style={[TYPE.dataLg, { color: color.creamInk }]}>{calls}</Text>
      </View>
    </Card>
  );
}

/**
 * `/stats` — web's StatsPage (features/stats/StatsPage.tsx): "Proof of demand." over the headline figure, then Growth
 * (the cumulative curve), Adoption (four tiles with their attribution note) and the live fill tape, each row a link to
 * its transaction. One read of `/api/traction`, polled every 30 s.
 */
export function StatsScreen() {
  const { color } = useTheme();
  const client = useQueryClient();
  const reading = useTraction();
  const nowMs = useChainNowMs();
  const t = reading?.ok ? reading.value : null;
  const words = STATS;

  return (
    <Screen title={words.title} onRefresh={() => client.invalidateQueries({ queryKey: TRACTION_KEY })}>
      <View style={styles.hero}>
        <View style={styles.headEyebrow}>
          <View style={[styles.dash, { backgroundColor: color.accent }]} />
          <Text style={[styles.eyebrow, { color: color.accent }]}>{words.hero.eyebrow.toUpperCase()}</Text>
        </View>
        <Text style={[TYPE.display, { color: color.ink }]} accessibilityRole="header">
          {words.hero.titleLead}
          {"\n"}
          <Text style={{ color: color.accent }}>{words.hero.titleAccent}</Text>.
        </Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{words.hero.lede}</Text>
      </View>

      <Headline wallets={t ? fmtCount(t.wallets) : "—"} calls={t ? fmtCount(t.calls) : "—"} />

      {reading === null ? <LoadingState shape="chart" label={words.reading} /> : null}
      {reading !== null && !reading.ok ? <ErrorState diagnosis={reading.error} retry={() => void client.invalidateQueries({ queryKey: TRACTION_KEY })} /> : null}
      {t ? (
        <>
          {reading?.ok && reading.stale ? <Text style={[TYPE.caption, { color: color.warning }]}>{words.unreachable}</Text> : null}
          <SectionHeader index={words.sections.growth.index} title={words.sections.growth.title} desc={words.sections.growth.tag} />
          <Card>
            <GrowthCurve points={t.curve} />
          </Card>

          <SectionHeader index={words.sections.adoption.index} title={words.sections.adoption.title} desc={words.sections.adoption.tag} />
          <View style={styles.grid}>
            <StatTile label={words.stats.wallets.label} value={fmtCount(t.wallets)} sub={words.stats.wallets.sub} accent />
            <StatTile label={words.stats.calls.label} value={fmtCount(t.calls)} sub={words.stats.calls.sub} />
            <StatTile
              label={words.stats.staked.label}
              value={formatBaseUnits(t.stakedBase, t.meta.decimals)}
              sub={t.meta.complete ? words.stats.staked.onLine(t.meta.symbol) : words.stats.staked.floor(t.meta.symbol)}
            />
            <StatTile label={words.stats.settled.label} value={fmtCount(t.settledWindows)} sub={words.stats.settled.sub(t.windows)} />
          </View>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {words.attribution(t.unattributed)}
            {t.meta.complete ? "" : ` ${words.floor}`}
          </Text>

          <SectionHeader
            index={words.sections.activity.index}
            title={words.sections.activity.title}
            desc="tap any row → Solana Explorer"
            aside={nowMs > 0 ? words.activity.updated(ago(t.meta.computedAtMs, nowMs)) : undefined}
          />
          <TractionTape events={t.recent} decimals={t.meta.decimals} symbol={t.meta.symbol} nowMs={nowMs || Date.now()} />
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.foot}</Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 10 },
  headEyebrow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dash: { width: 18, height: 1.5 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.6, flexShrink: 1 },
  big: { fontSize: 64, lineHeight: 68 },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
