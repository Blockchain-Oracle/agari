import { LUCKY_VERIFIED } from "@agari/core/games";
import type { Address } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { router, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyHistoryWire, LuckyRowWire } from "@/features/games/lucky/lucky-wire";
import { useLuckyBoard } from "@/features/games/lucky/useLuckyHistory";
import { Plate, PlateBody, PlateMeta, PlateTitle } from "~/features/games/frame";
import { useGames } from "~/features/games/shell";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { LuckyResultModal } from "./LuckyResultModal";
import { LinkWord, LUCKY_TEXT, useLuckyTokens } from "./parts";
import { luckyLoseSting, luckyWinSting } from "./reel-sfx";

const BOARD_SHOWN = 5;

interface Props {
  wallet: string | null;
  feed: LuckyHistoryWire | null;
  /** The spin placed in this session, watched so its verdict shows the moment the chain gives it. */
  watchDrawId: string | null;
  decimals: number | null;
  symbol: string;
}

/**
 * web's `LuckySide.tsx` (`.lk-side`): the mode's own sentence, this wallet's streak and best with a way to its
 * spins, the top five of the streak ladder, and the two things a player should know before the first spin. The
 * verdict watcher lives here because the history is polled here: when the spin placed in this session settles,
 * the result modal opens once, with the verdict's own sting.
 */
export function LuckySide({ wallet, feed, watchDrawId, decimals, symbol }: Props) {
  const { t, color } = useSideTokens();
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
    <View style={styles.side}>
      <Text style={[LUCKY_TEXT.body, { color: color.inkSecondary }]}>{LUCKY.intro}</Text>

      {feed?.configured ? (
        <Plate>
          <View style={styles.streak}>
            <Fact k={LUCKY.history.streak} v={feed.streak} />
            <Fact k={LUCKY.history.best} v={feed.best} />
          </View>
          <LinkWord label={LUCKY.history.title} onPress={() => router.push("/games/history" as Href)} style={styles.start} />
        </Plate>
      ) : null}

      <Plate>
        <PlateTitle>{words.title}</PlateTitle>
        <PlateBody>{words.intro}</PlateBody>
        {board === null ? (
          <PlateMeta>{words.loading}</PlateMeta>
        ) : !board.configured ? (
          <PlateMeta>{words.notConfigured}</PlateMeta>
        ) : board.rows.length === 0 ? (
          <PlateMeta>{words.empty}</PlateMeta>
        ) : (
          <View style={styles.board}>
            {board.rows.slice(0, BOARD_SHOWN).map((row, i) => {
              const you = row.wallet === wallet;
              return (
                <View key={row.wallet} style={[styles.rung, { borderColor: you ? t.you : color.hairline }]}>
                  <Text style={[styles.place, { color: color.inkMuted }]}>{i + 1}</Text>
                  <View style={styles.main}>
                    <Text style={[LUCKY_TEXT.v, { color: color.ink }]} numberOfLines={1}>
                      {you ? words.you : shortHex(row.wallet as Address, 6, 4)}
                    </Text>
                    <Text style={[LUCKY_TEXT.k, { color: color.inkMuted }]}>{words.spins(row.spins).toUpperCase()}</Text>
                  </View>
                  <View style={styles.rungSide}>
                    <Text style={[styles.rungV, { color: color.ink }]}>{row.streak}</Text>
                    <Text style={[LUCKY_TEXT.k, { color: color.inkMuted }]}>
                      {`${words.now} · ${words.best} ${row.best}`.toUpperCase()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Plate>

      <Plate>
        <PlateTitle>{LUCKY.deal.proof.label}</PlateTitle>
        <PlateBody>{LUCKY.deal.proof.scope}</PlateBody>
      </Plate>
      <Plate>
        <PlateBody>{LUCKY.deal.honesty}</PlateBody>
      </Plate>

      {shown ? <LuckyResultModal row={shown} decimals={decimals} symbol={symbol} streak={feed?.streak ?? 0} onClose={() => setShown(null)} /> : null}
    </View>
  );
}

/** The ladder's own row edge is the games accent (`--gm-accent`): the player's chosen ring, vermilion by default. */
function useSideTokens() {
  const { color } = useLuckyTokens();
  const { settings } = useGames();
  const you = settings.accent === "up" ? color.profit : settings.accent === "down" ? color.loss : color.accent;
  return { t: { you }, color };
}

/** `.gm-match-fact`: the mono key over the pixel figure (`.lk-streak-v`). */
function Fact({ k, v }: { k: string; v: number }) {
  const { color } = useLuckyTokens();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factK, { color: color.inkMuted }]}>{k.toUpperCase()}</Text>
      <Text style={[styles.factV, { color: color.accent }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { gap: 12 },
  streak: { flexDirection: "row", alignItems: "center", gap: 12 },
  start: { alignSelf: "flex-start" },
  fact: { gap: 2 },
  factK: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26 },
  factV: { fontFamily: PIXEL_FONT, fontSize: 33, lineHeight: 33, fontVariant: ["tabular-nums"] },
  board: { gap: 6 },
  rung: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1 },
  place: { minWidth: 22, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, fontVariant: ["tabular-nums"] },
  main: { flex: 1, minWidth: 0, gap: 2 },
  rungSide: { alignItems: "flex-end", gap: 2 },
  rungV: { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, fontVariant: ["tabular-nums"] },
});
