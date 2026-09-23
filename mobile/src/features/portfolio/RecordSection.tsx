import { computeBadges, computeTraderEdge, reputationOf, roundsToCsv } from "@agari/core/projection";
import { isOk } from "@agari/core/schemas";
import { useMakerShares, useMakerVault } from "@agari/markets/react";
import { useMemo } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { HISTORY } from "@/features/markets/history/copy";
import type { HistoryReading } from "@/features/markets/history/useHistoryReading";
import { Button, ReadingView, SectionHeader } from "~/components/kit";
import { pushToast } from "~/components/toast/store";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { BadgeGrid } from "./BadgeGrid";
import { EquitySparkline } from "./EquitySparkline";
import { signedMoney } from "./format";

/**
 * web `RecordSection` ("04 · Your record"): the summary strip — net over every settled Window, the curve that produced
 * it, win rate, the current run, the rows as a CSV (shared through the system sheet) — then reputation and badges.
 * All three read the one fill projection, as web's do; the LP badge reads maker-vault shares.
 */
export function RecordSection({ history, symbol, index }: { history: HistoryReading; symbol: string | undefined; index: string }) {
  const { color } = useTheme();
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

  const shareCsv = async () => {
    if (!value || !history.address) return;
    try {
      await Share.share({ title: HISTORY.csvName(history.address), message: roundsToCsv(value.rounds) });
    } catch {
      pushToast({ title: HISTORY.csvFailed, tone: "warning" });
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader index={index} title={HISTORY.summary.title} />
      <ReadingView reading={history.reading} loading="plate" retry={history.retry}>
        {(read) =>
          derived ? (
            <View style={styles.gap}>
              <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
                <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.summary.net}</Text>
                <Text style={[TYPE.dataLg, { color: derived.edge.netBase > 0n ? color.profit : derived.edge.netBase < 0n ? color.loss : color.ink }]}>{signedMoney(derived.edge.netBase, read.decimals, symbol)}</Text>
                <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{HISTORY.summary.rounds(derived.edge.settledRounds, derived.edge.openRounds)}</Text>
                <EquitySparkline points={derived.edge.equity} decimals={read.decimals} />
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.summary.winRate}</Text>
                    <Text style={[TYPE.data, { color: color.ink }]}>{derived.edge.winRatePct === null ? HISTORY.summary.notYet : `${derived.edge.winRatePct.toFixed(0)}%`}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.summary.streak}</Text>
                    <Text style={[TYPE.data, { color: color.ink }]}>
                      {derived.edge.currentWinStreak} {HISTORY.summary.streakUnit(derived.edge.currentWinStreak)}
                    </Text>
                  </View>
                </View>
                <Button label="Share CSV" variant="outline" size="sm" block={false} icon={{ ios: "square.and.arrow.up", android: "ios_share" }} disabled={read.rounds.length === 0} onPress={() => void shareCsv()} />
              </View>
              <Reputation reputation={derived.reputation} />
              <BadgeGrid badges={derived.badges} />
            </View>
          ) : null
        }
      </ReadingView>
    </View>
  );
}

/** web `ReputationPanel`'s plate: the tier, the record it rests on, and the distance to the next one. */
function Reputation({ reputation }: { reputation: ReturnType<typeof reputationOf> }) {
  const { color } = useTheme();
  const words = HISTORY.reputation;
  return (
    <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{words.tier}</Text>
      <Text style={[TYPE.headline, { color: color.ink }]}>{words.tiers[reputation.tier]}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.record(reputation.bets, reputation.wins)}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{reputation.nextTier ? words.next(words.tiers[reputation.nextTier]) : words.top}</Text>
      <View
        style={[styles.bar, { backgroundColor: color.surface2 }]}
        accessibilityRole="progressbar"
        accessibilityLabel={words.progress(reputation.progressToNext)}
        accessibilityValue={{ min: 0, max: 100, now: reputation.progressToNext }}
      >
        <View style={{ width: `${reputation.progressToNext}%`, backgroundColor: color.accent, height: "100%" }} />
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.rule}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  gap: { gap: 12 },
  plate: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  stats: { flexDirection: "row", gap: 24, paddingVertical: 4 },
  stat: { gap: 2 },
  bar: { height: 6, borderRadius: RADIUS.full, overflow: "hidden", marginVertical: 4 },
});
