import { computeBadges, computeTraderEdge, reputationOf, type TraderEdge, type WalletHistory } from "@agari/core/projection";
import { isOk, type Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { useMakerShares, useMakerVault } from "@agari/markets/react";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EDGE } from "@/features/edge/copy";
import { signedMoney, toneOf } from "@/features/edge/format";
import { PROFILE } from "@/features/profile/copy";
import { ErrorState, LoadingState } from "~/components/kit";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { FONT, useTheme } from "~/theme";
import { profileTokens } from "~/theme/web/explore/profile";
import { HistorySummary } from "./HistorySummary";
import { ReputationPanel } from "./ReputationPanel";

/** The leaderboard's `.lb-section-head` spacing, which the profile's sections borrow. */
export const SECTION_HEAD = { marginTop: 48, marginBottom: 24 } as const;

/** web's EdgeMetrics inside `.prf-edge` on a phone: four figures in a 2×2 ruled grid, each with what it is measured over. */
function EdgeMetrics({ report, decimals, symbol }: { report: TraderEdge; decimals: number; symbol: string }) {
  const { name, color } = useTheme();
  const t = profileTokens(name);
  const m = EDGE.report.metrics;
  const tone = report.expectancyBase === null ? "flat" : toneOf(report.expectancyBase);
  const cells = [
    { label: m.winRate.label, value: report.winRatePct === null ? m.winRate.unset : `${report.winRatePct.toFixed(0)}%`, note: m.winRate.note(report.wins, report.losses), ink: t.edgeText },
    { label: m.profitFactor.label, value: report.profitFactor === null ? m.profitFactor.noLoss : report.profitFactor.toFixed(2), note: m.profitFactor.note, ink: t.edgeText },
    {
      label: m.expectancy.label,
      value: report.expectancyBase === null ? m.expectancy.unset : signedMoney(report.expectancyBase, decimals, symbol),
      note: m.expectancy.note,
      ink: tone === "gain" ? color.profit : tone === "loss" ? color.loss : t.edgeText,
    },
    { label: m.drawdown.label, value: formatBaseUnits(report.maxDrawdownBase, decimals), note: m.drawdown.note(symbol), ink: t.edgeText },
  ];
  return (
    <View style={[styles.metrics, { borderColor: t.edgeRule, backgroundColor: t.edgePaper }]} accessibilityLabel="Performance metrics">
      {cells.map((cell, i) => (
        <View key={cell.label} style={[styles.metric, i % 2 === 1 ? { borderLeftWidth: 1, borderLeftColor: t.edgeRule } : null, i > 1 ? { borderTopWidth: 1, borderTopColor: t.edgeRule } : null]}>
          <Text style={[styles.edgeLabel, { color: t.edgeMuted }]}>{cell.label}</Text>
          <Text style={[styles.edgeValue, { color: cell.ink }]}>{cell.value}</Text>
          <Text style={[styles.edgeNote, { color: t.edgeFaint }]}>{cell.note}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * web's ProfileRecord: the record (the summary strip, reputation and badges) and the edge excerpt, from the one settled
 * history reading, computed exactly as Portfolio and Trader Edge compute them.
 */
export function ProfileRecord({ address, reading, retry, symbol, own }: { address: Address; reading: Reading<WalletHistory> | null; retry: () => void; symbol: string; own: boolean }) {
  const { color } = useTheme();
  const value = reading?.ok ? reading.value : null;
  const vault = useMakerVault();
  const shares = useMakerShares(address);
  const lpSharesRaw = vault && isOk(vault) ? (vault.value === null ? null : shares && isOk(shares) ? shares.value.shares : 0n) : 0n;
  const derived = useMemo(() => {
    if (!value) return null;
    const edge = computeTraderEdge(value.rounds, value.openCount);
    const decided = edge.wins + edge.losses;
    const winRate = decided > 0 ? edge.wins / decided : 0;
    return {
      edge,
      reputation: reputationOf(decided, edge.wins, edge.currentWinStreak),
      badges: computeBadges({ fillCount: value.fillCount, currentWinStreak: edge.currentWinStreak, stakeBase: edge.stakeBase, decidedRounds: decided, winRate, decimals: value.decimals, lpSharesRaw }),
    };
  }, [value, lpSharesRaw]);

  let record = null;
  if (reading === null) record = <LoadingState shape="plate" />;
  else if (!reading.ok) record = <ErrorState diagnosis={reading.error} retry={retry} />;
  else if (derived) {
    record = (
      <View style={styles.record}>
        <HistorySummary history={reading.value} edge={derived.edge} address={address} symbol={symbol} />
        <ReputationPanel reputation={derived.reputation} badges={derived.badges} />
      </View>
    );
  }

  const edgeLink = own ? (
    <Text style={[styles.edgeLink, { color: color.accent }]} accessibilityRole="link" onPress={() => router.push("/portfolio/edge" as never)}>
      {PROFILE.edge.open}
    </Text>
  ) : undefined;

  return (
    <>
      <View accessibilityLabel={PROFILE.record.title}>
        <SectionHeader index={PROFILE.record.number} title={PROFILE.record.title} desc={PROFILE.record.desc} style={SECTION_HEAD} />
        {record}
      </View>
      <View accessibilityLabel={PROFILE.edge.title}>
        <SectionHeader index={PROFILE.edge.number} title={PROFILE.edge.title} desc={PROFILE.edge.desc} aside={edgeLink} style={SECTION_HEAD} />
        {derived && value ? (
          derived.edge.settledRounds > 0 ? (
            <EdgeMetrics report={derived.edge} decimals={value.decimals} symbol={symbol} />
          ) : (
            <Text style={[styles.quiet, { color: color.inkDisabled }]}>{PROFILE.edge.none}</Text>
          )
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  record: { gap: 24 },
  metrics: { flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderRadius: 3, overflow: "hidden" },
  metric: { width: "50%", minWidth: 0, paddingVertical: 19, paddingHorizontal: 17 },
  edgeLabel: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.44, textTransform: "uppercase" },
  edgeValue: { marginTop: 10, fontFamily: FONT.dataStrong, fontSize: 20, lineHeight: 32, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  edgeNote: { marginTop: 7, fontFamily: FONT.body, fontSize: 10, lineHeight: 14.5 },
  edgeLink: { fontFamily: FONT.dataRegular, fontSize: 11, letterSpacing: 0.88 },
  quiet: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
});
