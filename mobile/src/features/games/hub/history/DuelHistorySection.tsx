import { isOk } from "@agari/core/schemas";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useNowMs } from "@/components/data/useNowMs";
import { GAMES } from "@/features/games/copy";
import { timeAgo } from "@/features/markets/history/time-ago";
import { useVenue } from "@/features/markets/useVenue";
import { usePager } from "@/lib/use-pager";
import { EmptyState, LoadingState } from "~/components/kit";
import { HistoryHead, HistoryPager, HistoryRow } from "./HistoryParts";

/** The fields of `@agari/db`'s DuelHistoryRow this list reads, as `/api/games/history` sends them. */
interface DuelRow {
  matchId: string;
  mode: string;
  status: string;
  creator: string;
  challenger: string | null;
  winner: string | null;
  creatorPnlBase: string | null;
  challengerPnlBase: string | null;
  potPerPlayerBase: string | null;
  deckSize: number;
  createdAtMs: number;
}

type Feed = { configured: boolean; rows: DuelRow[] } | null;

const POLL_MS = 8_000;
const PAGE_SIZE = 8;
const NO_ROWS: readonly DuelRow[] = [];

/**
 * web's `DuelHistory`: every duel this wallet has played, newest first — the mode and stake, the opponent, how
 * it ended, the PnL the arena measured, and when — polled every eight seconds, eight to a page. A row opens
 * that match. `reload` bumps on pull-to-refresh.
 */
export function DuelHistorySection({ address, reload }: { address: string; reload: number }) {
  const { boot } = useVenue();
  const nowMs = useNowMs();
  const [feed, setFeed] = useState<Feed>(null);
  const words = GAMES.historyPage;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/games/history?address=${address}`)
        .then((r) => r.json() as Promise<NonNullable<Feed>>)
        .then((body) => {
          if (alive && Array.isArray(body.rows)) setFeed(body);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [address, reload]);

  const pager = usePager(feed?.rows ?? NO_ROWS, PAGE_SIZE);
  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 2 }));

  return (
    <View style={{ gap: 10 }}>
      <HistoryHead eyebrow={GAMES.eyebrow} title={words.title} />
      {feed === null ? (
        <LoadingState shape="list" label={words.loading} />
      ) : !feed.configured ? (
        <EmptyState why={words.notConfigured} />
      ) : feed.rows.length === 0 ? (
        <EmptyState why={words.empty} action={{ label: "Find a duel", onPress: () => router.push("/games/duel" as Href) }} />
      ) : (
        <>
          {pager.slice.map((row) => {
            const creator = row.creator === address;
            const opponent = creator ? row.challenger : row.creator;
            const pnl = creator ? row.creatorPnlBase : row.challengerPnlBase;
            const live = row.status !== "finalized" && row.status !== "refunded";
            const verdict = live ? "live" : row.winner === null ? "tied" : row.winner === address ? "won" : "lost";
            const word = live ? words.live : row.winner === null ? words.tied : row.winner === address ? words.won : words.lost;
            const signed = pnl === null ? null : BigInt(pnl);
            const value = signed === null ? "—" : `${signed > 0n ? "+" : signed < 0n ? "−" : ""}${money((signed < 0n ? -signed : signed).toString())} ${symbol}`;
            const main = opponent ? shortHex(opponent, 6, 4) : words.noOpponent;
            const detail = `${row.mode === "free" ? words.free : words.ranked(money(row.potPerPlayerBase), symbol)} · ${row.deckSize} ${words.cards}`;
            const time = nowMs > 0 && row.createdAtMs > 0 ? timeAgo(row.createdAtMs, nowMs) : "";
            return (
              <HistoryRow
                key={row.matchId}
                verdict={verdict}
                word={word}
                main={main}
                detail={detail}
                value={value}
                valueTone={signed === null || signed === 0n ? undefined : signed > 0n ? "profit" : "loss"}
                time={time}
                label={`${word}. ${main}. ${detail}. ${value}. ${time}`}
                onPress={() => router.push(`/games/duel/${row.matchId}` as Href)}
              />
            );
          })}
          <HistoryPager pager={pager} />
        </>
      )}
    </View>
  );
}
