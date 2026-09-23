import type { Signature } from "@agari/core/types";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LUCKY } from "@/features/games/lucky/copy";
import type { LuckyHistoryWire, LuckyRowWire } from "@/features/games/lucky/lucky-wire";
import { timeAgo } from "@/features/markets/history/time-ago";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { Button, EmptyState, LoadingState, SectionHeader } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { TYPE, useTheme } from "~/theme";

/** Eight spins a page, the portfolio's own page size; "Show more" adds the next eight. */
const PAGE_SIZE = 8;

/**
 * web's `LuckyHistory.tsx`: every spin this wallet made, newest first — the result word the chain (or the book, or
 * the player) gave it, the draw, what was staked and what the tape measured, the transaction, and when. Nothing here
 * is a verdict the chain has not given: a live row says live, an unconfirmed send says so, a refusal names its reason.
 */
export function LuckyHistory({ feed, connected, decimals, symbol }: { feed: LuckyHistoryWire | null; connected: boolean; decimals: number | null; symbol: string }) {
  const { color } = useTheme();
  const [shown, setShown] = useState(PAGE_SIZE);
  const words = LUCKY.history;
  const nowMs = Date.now();

  return (
    <>
      <SectionHeader index="02" title={words.title} />
      {!connected ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.connect}</Text>
      ) : feed === null ? (
        <LoadingState shape="list" label={words.loading} />
      ) : !feed.configured ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{words.notConfigured}</Text>
      ) : feed.rows.length === 0 ? (
        <EmptyState why={words.empty} detail={LUCKY.intro} />
      ) : (
        <View>
          {feed.rows.slice(0, shown).map((row) => (
            <SpinRow key={row.drawId} row={row} decimals={decimals} symbol={symbol} nowMs={nowMs} />
          ))}
          {feed.rows.length > shown ? (
            <Button label="Show more" variant="ghost" size="sm" onPress={() => setShown((n) => n + PAGE_SIZE)} />
          ) : null}
        </View>
      )}
    </>
  );
}

function SpinRow({ row, decimals, symbol, nowMs }: { row: LuckyRowWire; decimals: number | null; symbol: string; nowMs: number }) {
  const { color } = useTheme();
  const words = LUCKY.history;
  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 0 }));
  const ink = row.result === "won" ? color.profit : row.result === "lost" ? color.loss : row.result === "pending" || row.result === "placed" ? color.accent : color.inkMuted;
  const what = row.asset && row.side && row.multiplier ? words.line(row.asset, SIDE_WORD[row.side], row.multiplier) : words.undealt;
  const spent = row.costBase ? words.cost(money(row.costBase), symbol) : words.stake(money(row.stakeBase), symbol);
  const contracts = row.quantityRaw ? ` · ${words.contracts(money(row.quantityRaw))}` : "";
  const refusal = row.refusal && (row.result === "refused" || row.result === "unknown") ? ` · ${words.refusal[row.refusal] ?? row.refusal}` : "";
  const verdict = words.results[row.result] ?? row.result;

  return (
    <View style={[styles.row, { borderBottomColor: color.hairline }]} accessible accessibilityLabel={`${verdict}. ${what}. ${spent}${contracts}${refusal}`}>
      <Text style={[TYPE.labelMicro, styles.verdict, { color: ink }]}>{verdict}</Text>
      <View style={styles.main}>
        <Text style={[TYPE.data, { color: color.ink }]}>{what}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {spent}
          {contracts}
          {refusal}
        </Text>
      </View>
      <View style={styles.side}>
        {row.txHash ? (
          <Pressable onPress={() => void openExternal(txUrl(row.txHash as Signature))} accessibilityRole="link" accessibilityLabel={`${words.tx} ${row.txHash}`} hitSlop={10}>
            <Text style={[TYPE.data, { color: color.accent }]}>{shortHex(row.txHash, 4, 4)}</Text>
          </Pressable>
        ) : (
          <Text style={[TYPE.data, { color: color.inkMuted }]}>—</Text>
        )}
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{row.createdAtMs > 0 ? timeAgo(row.createdAtMs, nowMs) : ""}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56 },
  verdict: { width: 74 },
  main: { flex: 1, gap: 2 },
  side: { alignItems: "flex-end", gap: 2 },
});
