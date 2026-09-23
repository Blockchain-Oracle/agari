import type { TickerSymbol } from "@agari/core/market";
import type { EventMarket, LaneBasis } from "@agari/core/types";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { laneAssetLabel, laneCadenceLabel, pausedCopy } from "@/features/markets/lanes/lane-view";
import { LANE_STATE, MARKETS, PREOPEN } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { Button, Card, Pill } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";

/** Masayume's between-rounds slot (`.market-card-pending`): the head, a dot and one sentence, and at most one action. */
export function PendingCard({ asset, label, cadence, clock, headline, why, children }: {
  asset: string;
  label: string;
  cadence: string;
  clock: string;
  headline: string;
  why: string;
  children?: ReactNode;
}) {
  const { color } = useTheme();
  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.asset}>
          <AssetDisc asset={asset} size={28} />
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{label}</Text>
          <Pill label={cadence} />
        </View>
        <Pill label={clock} dot />
      </View>
      <View style={[styles.pending, { borderColor: color.hairline }]}>
        <View style={[styles.dot, { backgroundColor: color.accent }]} />
        <Text style={[TYPE.body, styles.grow, { color: color.inkSecondary }]}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{headline}.</Text> {why}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/**
 * web's ListedCard (D-088): a Regular or Gap Window listed before its open, as the pending card with the one action
 * it has — schedule a call at your own price. A Gap keeps its own words (when calls open, when it locks, which print).
 */
export function ListedCard({ market }: { market: EventMarket }) {
  const when = useWhen();
  const gap = market.lane === "gap";
  const label = laneAssetLabel(market.asset, market.lane);
  const opens = when(market.tradingStartSec);
  const schedule = () => router.push({ pathname: "/ticket", params: { m: market.marketId } });
  return (
    <PendingCard
      asset={market.asset}
      label={label}
      cadence={laneCadenceLabel(market.lane, market.intervalSec)}
      clock={PREOPEN.card.clock}
      headline={gap ? LANE_STATE.gap.listed(opens) : PREOPEN.card.headline(opens)}
      why={gap ? LANE_STATE.gap.listedWhy(when(market.lockAtSec), when(market.expirySec, { seconds: true })) : PREOPEN.card.why}
    >
      <View style={styles.actions}>
        <Button label={PREOPEN.card.cta} size="sm" icon={{ ios: "calendar.badge.clock", android: "schedule" }} onPress={schedule} accessibilityHint={PREOPEN.card.hint} style={styles.grow} />
        <Button label="Window" size="sm" variant="ghost" block={false} onPress={() => router.push({ pathname: "/markets/[id]", params: { id: market.marketId } })} />
      </View>
    </PendingCard>
  );
}

/** web's PausedCard: a ticker the roller paused in this lane, with the roller's own reason. Nothing to open. */
export function PausedCard({ asset, basis, intervalSec, state }: { asset: TickerSymbol; basis: LaneBasis; intervalSec: number; state: string }) {
  const label = laneAssetLabel(asset, basis);
  const { headline, why } = pausedCopy(state, label, basis, intervalSec);
  return <PendingCard asset={asset} label={label} cadence={laneCadenceLabel(basis, intervalSec)} clock={MARKETS.paused.clock} headline={headline} why={why} />;
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  asset: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  pending: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  dot: { width: 7, height: 7, borderRadius: RADIUS.full, marginTop: 8 },
  grow: { flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
