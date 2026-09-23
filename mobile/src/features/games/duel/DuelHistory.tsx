import { isOk } from "@agari/core/schemas";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import { timeAgo } from "@/features/markets/history/time-ago";
import { useVenue } from "@/features/markets/useVenue";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, EmptyState, haptic, LoadingState, SectionHeader } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { Avatar, Body, Refusal } from "./parts";

/** One row of `/api/games/history` (`@agari/db` `DuelHistoryRow`, the fields this screen reads). */
interface HistoryRow {
  matchId: string;
  mode: string;
  creator: string;
  challenger: string | null;
  status: string;
  deckSize: number;
  potPerPlayerBase: string | null;
  winner: string | null;
  creatorPnlBase: string | null;
  challengerPnlBase: string | null;
  createdAtMs: number;
}

type Feed = { configured: boolean; rows: HistoryRow[] } | null;

const POLL_MS = 8_000;
const PAGE_SIZE = 8;

/**
 * web's `DuelHistory.tsx` (`/games/history`): every duel this wallet has played, newest first, as rows that open
 * the match — mode and stake, the opponent, how it ended, the PnL the arena measured, and when. Polls as web does.
 * `compact` is the duel screen's own short list; the full list pages eight at a time.
 */
export function DuelHistory({ compact = false }: { compact?: boolean }) {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const nowMs = useNowMs();
  const [feed, setFeed] = useState<Feed>(null);
  const [shown, setShown] = useState(compact ? 3 : PAGE_SIZE);
  const words = GAMES.historyPage;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";

  const load = useCallback(
    () =>
      address
        ? fetch(`/api/games/history?address=${address}`)
            .then((r) => r.json() as Promise<NonNullable<Feed>>)
            .then(setFeed)
            .catch(() => undefined)
        : Promise.resolve(),
    [address],
  );

  useEffect(() => {
    setFeed(null);
    if (!address) return;
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [address, load]);

  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 2 }));
  const rows = feed?.rows ?? [];

  return (
    <View style={styles.wrap}>
      <SectionHeader index="02" title={words.title} />
      {!address ? (
        <Body>{words.connect}</Body>
      ) : feed === null ? (
        <LoadingState shape="list" label={words.loading} />
      ) : !feed.configured ? (
        <Refusal>{words.notConfigured}</Refusal>
      ) : rows.length === 0 ? (
        <EmptyState why={words.empty} />
      ) : (
        <>
          {rows.slice(0, shown).map((row) => {
            const creator = row.creator === address;
            const opponent = creator ? row.challenger : row.creator;
            const pnl = creator ? row.creatorPnlBase : row.challengerPnlBase;
            const live = row.status !== "finalized" && row.status !== "refunded";
            const verdict = live ? words.live : row.winner === null ? words.tied : row.winner === address ? words.won : words.lost;
            const verdictInk = live ? color.accent : row.winner === null ? color.inkSecondary : row.winner === address ? color.profit : color.loss;
            const pnlBig = pnl === null ? null : BigInt(pnl);
            const pnlText = pnlBig === null ? "—" : `${pnlBig > 0n ? "+" : pnlBig < 0n ? "−" : ""}${money(pnlBig < 0n ? String(-pnlBig) : pnl)} ${symbol}`;
            const stake = row.mode === "free" ? words.free : words.ranked(money(row.potPerPlayerBase), symbol);
            return (
              <Pressable
                key={row.matchId}
                onPress={() => {
                  haptic.tap();
                  router.push(`/games/duel/${row.matchId}` as never);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${verdict}, ${opponent ? shortHex(opponent, 6, 4) : words.noOpponent}, ${stake}, ${pnlText}`}
                style={({ pressed }) => [styles.row, { borderColor: color.hairline, backgroundColor: color.surface1 }, pressed && { opacity: 0.8 }]}
              >
                <Text style={[styles.verdict, { color: verdictInk }]}>{verdict.toUpperCase()}</Text>
                <Avatar address={opponent} size={26} />
                <View style={styles.main}>
                  <Text style={[styles.addr, { color: color.ink }]}>{opponent ? shortHex(opponent, 6, 4) : words.noOpponent}</Text>
                  <Text style={[styles.sub, { color: color.inkMuted }]} numberOfLines={1}>
                    {stake} · {row.deckSize} {words.cards}
                  </Text>
                </View>
                <View style={styles.side}>
                  <Text style={[styles.pnl, { color: pnlBig === null || pnlBig === 0n ? color.inkSecondary : pnlBig > 0n ? color.profit : color.loss }]}>{pnlText}</Text>
                  <Text style={[styles.sub, { color: color.inkMuted }]}>{nowMs > 0 && row.createdAtMs > 0 ? timeAgo(row.createdAtMs, nowMs) : ""}</Text>
                </View>
                <SymbolView name={{ ios: "chevron.right", android: "chevron_right" }} size={12} tintColor={color.inkMuted} />
              </Pressable>
            );
          })}
          {rows.length > shown ? <Button label={`Show ${Math.min(PAGE_SIZE, rows.length - shown)} more`} variant="secondary" size="sm" onPress={() => setShown((n) => n + PAGE_SIZE)} /> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  verdict: { fontFamily: FONT.dataStrong, fontSize: 10, letterSpacing: 1, width: 38 },
  main: { flex: 1, gap: 2 },
  addr: { fontFamily: FONT.data, fontSize: 12.5 },
  sub: { fontFamily: FONT.data, fontSize: 10 },
  side: { alignItems: "flex-end", gap: 2 },
  pnl: { fontFamily: FONT.dataStrong, fontSize: 12, fontVariant: ["tabular-nums"] },
});
