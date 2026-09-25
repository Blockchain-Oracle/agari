import { isOk } from "@agari/core/schemas";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyRowWire } from "@/features/games/lucky/lucky-wire";
import { useLuckyHistory } from "@/features/games/lucky/useLuckyHistory";
import { timeAgo } from "@/features/markets/history/time-ago";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useVenue } from "@/features/markets/useVenue";
import { usePager } from "@/lib/use-pager";
import { StageHead } from "~/features/games/stage";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { Body, Foot, Refusal, useDuelTokens } from "../../duel/parts";
import { HistoryPager, HistoryRow, historyStyles, type Verdict } from "./HistoryParts";

const PAGE_SIZE = 8;
const NO_ROWS: readonly LuckyRowWire[] = [];

/**
 * web's `LuckyHistory` (the second section of `/games/history`): every spin this wallet made, newest first, in the
 * duel's row grammar — the word the chain (or the book, or the player) gave it, the draw, what was staked, the
 * transaction as a dotted link, and when — with the streak the settled rows add up to beside the title.
 */
export function LuckyHistorySection({ address, reload }: { address: string | null; reload: number }) {
  const { color } = useDuelTokens();
  const { boot } = useVenue();
  const nowMs = useNowMs();
  const { feed, refresh } = useLuckyHistory((address ?? null) as never);
  const pager = usePager(feed?.rows ?? NO_ROWS, PAGE_SIZE);
  const words = LUCKY.history;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 0 }));

  useEffect(() => {
    if (reload > 0) refresh();
  }, [reload, refresh]);

  return (
    <View accessibilityLabel={words.title}>
      <View style={styles.head}>
        <View style={styles.headTitle}>
          <StageHead eyebrow={LUCKY.eyebrow} title={words.title} />
        </View>
        {feed?.configured ? (
          <View style={styles.streak} accessible accessibilityLabel={`${words.streak} ${feed.streak}, ${words.best} ${feed.best}`}>
            <Text style={[styles.streakK, { color: color.inkMuted }]}>
              {words.streak.toUpperCase()}
              <Text style={[styles.streakV, { color: color.accent }]}> {feed.streak}</Text>
            </Text>
            <Text style={[styles.streakK, { color: color.inkMuted }]}>
              {words.best.toUpperCase()}
              <Text style={[styles.streakV, { color: color.accent }]}> {feed.best}</Text>
            </Text>
          </View>
        ) : null}
      </View>
      {!address ? (
        <Body>{words.connect}</Body>
      ) : feed === null ? (
        <Body>{words.loading}</Body>
      ) : !feed.configured ? (
        <Refusal>{words.notConfigured}</Refusal>
      ) : feed.rows.length === 0 ? (
        <Body>{words.empty}</Body>
      ) : (
        <>
          <View style={historyStyles.list}>
            {pager.slice.map((row) => {
              const word = words.results[row.result] ?? row.result;
              const main = row.asset && row.side && row.multiplier ? words.line(row.asset, SIDE_WORD[row.side], row.multiplier) : words.undealt;
              const refusal = row.refusal && (row.result === "refused" || row.result === "unknown") ? ` · ${words.refusal[row.refusal] ?? row.refusal}` : "";
              const detail = `${row.costBase ? words.cost(money(row.costBase), symbol) : words.stake(money(row.stakeBase), symbol)}${row.quantityRaw ? ` · ${words.contracts(money(row.quantityRaw))}` : ""}${refusal}`;
              const time = nowMs > 0 && row.createdAtMs > 0 ? timeAgo(row.createdAtMs, nowMs) : "";
              const tx = row.txHash;
              return (
                <HistoryRow
                  key={row.drawId}
                  verdict={verdictOf(row)}
                  word={word}
                  main={main}
                  detail={detail}
                  value={
                    tx ? (
                      <Pressable onPress={() => void openExternal(txUrl(tx))} accessibilityRole="link" hitSlop={8}>
                        <Text style={[styles.hash, { color: color.ink }]}>{shortHex(tx)}</Text>
                      </Pressable>
                    ) : (
                      "—"
                    )
                  }
                  time={time}
                  label={`${word}. ${main}. ${detail}. ${time}`}
                />
              );
            })}
          </View>
          <HistoryPager pager={pager} />
        </>
      )}
      <Foot>{GAMES.history.body}</Foot>
    </View>
  );
}

/** The row's colour follows the chain's word: won and lost only; pending and placed are live; the rest quiet. */
function verdictOf(row: LuckyRowWire): Verdict {
  if (row.result === "won" || row.result === "lost") return row.result;
  if (row.result === "pending" || row.result === "placed") return "live";
  return "neutral";
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", columnGap: 12, marginBottom: -8 },
  headTitle: { flexShrink: 1 },
  streak: { flexDirection: "row", gap: 16, paddingBottom: 20 },
  streakK: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.8 },
  streakV: { fontFamily: PIXEL_FONT, fontSize: 16, letterSpacing: 0 },
  hash: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4, textDecorationLine: "underline", textDecorationStyle: "dotted" },
});
