import { LUCKY_VERIFIED } from "@agari/core/games";
import type { Address } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyHistoryWire, LuckyRowWire } from "@/features/games/lucky/lucky-wire";
import { useLuckyBoard } from "@/features/games/lucky/useLuckyHistory";
import { Card, LoadingState, SectionHeader } from "~/components/kit";
import { useGames } from "~/features/games/shell";
import { TYPE, useTheme } from "~/theme";
import { LuckyResultModal } from "./LuckyResultModal";
import { luckyLoseSting, luckyWinSting } from "./reel-sfx";

interface Props {
  wallet: string | null;
  feed: LuckyHistoryWire | null;
  /** The spin placed in this session, watched so its verdict shows the moment the chain gives it. */
  watchDrawId: string | null;
  decimals: number | null;
  symbol: string;
  reduced: boolean;
}

/**
 * web's `LuckySide.tsx`: this wallet's streak, the top of the streak ladder, and the two things a player should know
 * before the first spin. The streak and the ladder count settled spins only. The verdict watcher lives here because
 * the history is polled here: when the spin placed in this session settles, the result modal opens once, with the
 * verdict's own sting.
 */
export function LuckySide({ wallet, feed, watchDrawId, decimals, symbol, reduced }: Props) {
  const { color } = useTheme();
  const { settings } = useGames();
  const board = useLuckyBoard();
  const [shown, setShown] = useState<LuckyRowWire | null>(null);
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!watchDrawId || !feed) return;
    const row = feed.rows.find((r) => r.drawId === watchDrawId);
    if (!row || announced.current === row.drawId) return;
    const settled = LUCKY_VERIFIED.has(row.result) || row.result === "cashed-out";
    if (!settled) return;
    announced.current = row.drawId;
    setShown(row);
    if (row.result === "won") luckyWinSting(settings.haptics);
    else if (row.result === "lost") luckyLoseSting(settings.haptics);
  }, [watchDrawId, feed, settings.haptics]);

  const words = LUCKY.board;
  return (
    <>
      {feed?.configured ? (
        <View style={styles.streak}>
          <Fact label={LUCKY.history.streak} value={String(feed.streak)} />
          <Fact label={LUCKY.history.best} value={String(feed.best)} />
        </View>
      ) : null}

      <SectionHeader index="03" title={words.title} desc={words.intro} />
      {board === null ? (
        <LoadingState shape="list" label={words.loading} />
      ) : !board.configured ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.notConfigured}</Text>
      ) : board.rows.length === 0 ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.empty}</Text>
      ) : (
        <View>
          {board.rows.slice(0, 5).map((row, i) => {
            const you = row.wallet === wallet;
            return (
              <View key={row.wallet} style={[styles.rung, { borderBottomColor: color.hairline }, you && { backgroundColor: color.accentWash }]}>
                <Text style={[TYPE.dataLg, styles.place, { color: i === 0 ? color.accent : color.inkMuted }]}>{i + 1}</Text>
                <View style={styles.rungMain}>
                  <Text style={[TYPE.data, { color: color.ink }]}>{you ? words.you : shortHex(row.wallet as Address, 6, 4)}</Text>
                  <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.spins(row.spins)}</Text>
                </View>
                <View style={styles.rungSide}>
                  <Text style={[TYPE.dataLg, { color: color.ink }]}>{row.streak}</Text>
                  <Text style={[TYPE.caption, { color: color.inkMuted }]}>
                    {words.now} · {words.best} {row.best}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Card>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{LUCKY.deal.proof.label}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{LUCKY.deal.proof.scope}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{LUCKY.deal.honesty}</Text>
      </Card>

      {shown ? <LuckyResultModal row={shown} decimals={decimals} symbol={symbol} streak={feed?.streak ?? 0} reduced={reduced} onClose={() => setShown(null)} /> : null}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.dataHero, { color: color.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  streak: { flexDirection: "row", gap: 10 },
  fact: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 6 },
  rung: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  place: { width: 26, textAlign: "center" },
  rungMain: { flex: 1, gap: 2 },
  rungSide: { alignItems: "flex-end", gap: 2 },
});
