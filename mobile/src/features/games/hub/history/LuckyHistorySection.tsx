import { isOk } from "@agari/core/schemas";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { router, type Href } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyRowWire } from "@/features/games/lucky/lucky-wire";
import { useLuckyHistory } from "@/features/games/lucky/useLuckyHistory";
import { timeAgo } from "@/features/markets/history/time-ago";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useVenue } from "@/features/markets/useVenue";
import { usePager } from "@/lib/use-pager";
import { EmptyState, LoadingState } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { TYPE, useTheme } from "~/theme";
import { HistoryHead, HistoryPager, HistoryRow, type Verdict } from "./HistoryParts";

const PAGE_SIZE = 8;
const NO_ROWS: readonly LuckyRowWire[] = [];

/**
 * web's `LuckyHistory`: every spin this wallet made, newest first, in the duel's row grammar — the word the
 * chain (or the book, or the player) gave it, the draw, what was staked, the transaction, and when — with the
 * streak the settled rows add up to. A row with a transaction opens it on the explorer.
 */
export function LuckyHistorySection({ address, reload }: { address: string; reload: number }) {
  const { color } = useTheme();
  const { boot } = useVenue();
  const nowMs = useNowMs();
  const { feed, refresh } = useLuckyHistory(address as never);
  const pager = usePager(feed?.rows ?? NO_ROWS, PAGE_SIZE);
  const words = LUCKY.history;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 0 }));

  useEffect(() => {
    if (reload > 0) refresh();
  }, [reload, refresh]);

  const streak = feed?.configured ? (
    <View style={styles.streak} accessible accessibilityLabel={`${words.streak} ${feed.streak}, ${words.best} ${feed.best}`}>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {words.streak} <Text style={[TYPE.data, { color: color.ink }]}>{feed.streak}</Text>
      </Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {words.best} <Text style={[TYPE.data, { color: color.ink }]}>{feed.best}</Text>
      </Text>
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <HistoryHead eyebrow={LUCKY.eyebrow} title={words.title} aside={streak} />
      {feed === null ? (
        <LoadingState shape="list" label={words.loading} />
      ) : !feed.configured ? (
        <EmptyState why={words.notConfigured} />
      ) : feed.rows.length === 0 ? (
        <EmptyState why={words.empty} action={{ label: "Spin Lucky", onPress: () => router.push("/games/lucky" as Href) }} />
      ) : (
        <>
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
                value={tx ? shortHex(tx, 4, 4) : "—"}
                time={time}
                label={`${word}. ${main}. ${detail}. ${time}${tx ? ". Opens the transaction" : ""}`}
                onPress={tx ? () => void openExternal(txUrl(tx)) : undefined}
              />
            );
          })}
          <HistoryPager pager={pager} />
        </>
      )}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{GAMES.history.body}</Text>
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
  root: { gap: 10 },
  streak: { alignItems: "flex-end" },
});
