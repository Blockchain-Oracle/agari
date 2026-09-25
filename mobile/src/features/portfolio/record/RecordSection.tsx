import { computeBadges, computeTraderEdge, reputationOf, roundsToCsv, type TraderEdge, type WalletHistory } from "@agari/core/projection";
import { isOk } from "@agari/core/schemas";
import { useMakerShares, useMakerVault } from "@agari/markets/react";
import { Download } from "lucide-react-native";
import { useMemo } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import type { HistoryReading } from "@/features/markets/history/useHistoryReading";
import { ReadingBoundary, SectionHeader, usePortfolioTokens, WebButton } from "~/components/portfolio/web";
import { pushToast } from "~/components/toast/store";
import { FONT, useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { MoneyText } from "../bets/RowParts";
import { BadgeGrid } from "./BadgeGrid";
import { EquitySparkline } from "./EquitySparkline";

/** web `HistorySummary` (`.history-summary`, one column on a phone): net, the curve, win rate and streak, then the CSV. */
function HistorySummary({ history, edge, address, symbol }: { history: WalletHistory; edge: TraderEdge; address: string; symbol: string | undefined }) {
  const { color } = useTheme();
  const share = async () => {
    try {
      await Share.share({ title: HISTORY.csvName(address), message: roundsToCsv(history.rounds) });
    } catch {
      pushToast({ title: HISTORY.csvFailed, tone: "warning" });
    }
  };
  return (
    <View style={[styles.plate, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <View style={styles.figure}>
        <Text style={[WEB_TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.summary.net}</Text>
        <Text style={WEB_TYPE.dataLg}>
          <MoneyText value={edge.netBase} decimals={history.decimals} symbol={symbol} pnl />
        </Text>
        <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{HISTORY.summary.rounds(edge.settledRounds, edge.openRounds)}</Text>
      </View>
      <EquitySparkline points={edge.equity} decimals={history.decimals} />
      <View style={styles.stats}>
        <View>
          <Text style={[WEB_TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.summary.winRate}</Text>
          <Text style={[WEB_TYPE.data, { color: color.ink }]}>{edge.winRatePct === null ? HISTORY.summary.notYet : `${edge.winRatePct.toFixed(0)}%`}</Text>
        </View>
        <View>
          <Text style={[WEB_TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.summary.streak}</Text>
          <Text style={[WEB_TYPE.data, { color: color.ink }]}>
            {edge.currentWinStreak} {HISTORY.summary.streakUnit(edge.currentWinStreak)}
          </Text>
        </View>
      </View>
      <WebButton label={HISTORY.csv} variant="outline" size="sm" disabled={history.rounds.length === 0} icon={<Download size={14} color={color.ink} />} onPress={() => void share()} />
    </View>
  );
}

/** web `ReputationPanel` (`.reputation-plate`): the tier in Sora 800, the record it rests on, the bar to the next tier, then the badges. */
function ReputationPanel({ reputation, badges }: { reputation: ReturnType<typeof reputationOf>; badges: ReturnType<typeof computeBadges> }) {
  const { color } = useTheme();
  const t = usePortfolioTokens();
  const words = HISTORY.reputation;
  return (
    <View style={styles.rep}>
      <View style={[styles.plate, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
        <View style={styles.figure}>
          <Text style={[WEB_TYPE.labelMicro, { color: color.inkMuted }]}>{words.tier}</Text>
          <Text style={[styles.tier, { color: color.ink }]}>{words.tiers[reputation.tier]}</Text>
          <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{words.record(reputation.bets, reputation.wins)}</Text>
        </View>
        <View style={styles.next}>
          <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{reputation.nextTier ? words.next(words.tiers[reputation.nextTier]) : words.top}</Text>
          <View
            style={[styles.bar, { backgroundColor: t.repBar }]}
            accessibilityRole="progressbar"
            accessibilityLabel={words.progress(reputation.progressToNext)}
            accessibilityValue={{ min: 0, max: 100, now: reputation.progressToNext }}
          >
            <View style={[styles.fill, { width: `${reputation.progressToNext}%`, backgroundColor: t.vermilion }]} />
          </View>
          <Text style={[WEB_TYPE.caption, { color: color.inkMuted }]}>{words.rule}</Text>
        </View>
      </View>
      <BadgeGrid badges={badges} />
    </View>
  );
}

/** web `RecordSection` ("04 · Your record"): the summary strip, then reputation and badges — all three read one projection. */
export function RecordSection({ history, symbol, index }: { history: HistoryReading; symbol: string | undefined; index: string }) {
  const value = history.reading?.ok ? history.reading.value : null;
  const vault = useMakerVault();
  const shares = useMakerShares(history.address);
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

  return (
    <View style={styles.section}>
      <SectionHeader index={index} title={HISTORY.summary.title} />
      <ReadingBoundary reading={history.reading} shape="plate" retry={history.retry}>
        {(read) =>
          derived && history.address ? (
            <View style={styles.stack}>
              <HistorySummary history={read} edge={derived.edge} address={history.address} symbol={symbol} />
              <ReputationPanel reputation={derived.reputation} badges={derived.badges} />
            </View>
          ) : null
        }
      </ReadingBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  stack: { gap: 24 },
  plate: { gap: 16, padding: 16, borderWidth: 1, borderRadius: 12 },
  figure: { gap: 4 },
  stats: { flexDirection: "row", gap: 28 },
  rep: { gap: 16 },
  tier: { fontFamily: FONT.headingHeavy, fontSize: 32, lineHeight: 34, letterSpacing: -0.96 },
  next: { gap: 8 },
  bar: { height: 6, overflow: "hidden", borderRadius: 999 },
  fill: { height: "100%", minWidth: 6, borderRadius: 999 },
});
