"use client";

import type { DuelHistoryRow } from "@masayume/db";
import { isOk } from "@masayume/core/schemas";
import { formatBaseUnits, shortHex } from "@masayume/core/units";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Pager } from "@/components/chrome";
import { useNowMs } from "@/components/data";
import { useVenue } from "@/features/markets";
import { timeAgo } from "@/features/markets/history/time-ago";
import { usePager } from "@/lib/use-pager";
import { useWalletSession } from "@/lib/wallet-session";
import { GAMES } from "../copy";

/** Flicky polls its history every eight seconds; a compact list needs no socket. */
const POLL_MS = 8_000;
/** Eight duels a page, the portfolio's own page size, with a pager beneath (owner, 2026-09-04). */
const PAGE_SIZE = 8;
const NO_ROWS: readonly DuelHistoryRow[] = [];

type Feed = { configured: boolean; rows: DuelHistoryRow[] } | null;

/**
 * `/games/history` — every duel this wallet has played, newest first, as tappable rows: the mode and
 * stake, the opponent, how it ended, the PnL the arena measured, and when. Flicky's `history.tsx`,
 * over the projector's own table, so a row is a fact the settler wrote and never a log replay.
 */
export function DuelHistory() {
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const nowMs = useNowMs();
  const [feed, setFeed] = useState<Feed>(null);
  const words = GAMES.historyPage;
  const decimals = boot && isOk(boot) ? boot.value.collateral.decimals : null;
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";

  useEffect(() => {
    if (!address) {
      setFeed(null);
      return;
    }
    let alive = true;
    const load = () =>
      fetch(`/api/games/history?address=${address}`)
        .then((r) => r.json() as Promise<NonNullable<Feed>>)
        .then((body) => {
          if (alive) setFeed(body);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [address]);

  const pager = usePager(feed?.rows ?? NO_ROWS, PAGE_SIZE);
  const you = address?.toLowerCase() ?? null;
  const money = (base: string | null) => (base === null || decimals === null ? "—" : formatBaseUnits(BigInt(base), decimals, { maxDp: 2, minDp: 2 }));

  return (
    <div className="container gm-page">
      <header className="du-head">
        <span className="gm-eyebrow">{GAMES.eyebrow}</span>
        <h1 className="du-title">
          {words.title}
          <span className="accent">.</span>
        </h1>
      </header>
      {!address ? (
        <p className="du-body">{words.connect}</p>
      ) : feed === null ? (
        <p className="du-body">{words.loading}</p>
      ) : !feed.configured ? (
        <p className="du-refusal">{words.notConfigured}</p>
      ) : feed.rows.length === 0 ? (
        <p className="du-body">{words.empty}</p>
      ) : (
        <>
        <ul className="du-history">
          {pager.slice.map((row) => {
            const creator = row.creator.toLowerCase() === you;
            const opponent = creator ? row.challenger : row.creator;
            const pnl = creator ? row.creatorPnlBase : row.challengerPnlBase;
            const live = row.status !== "finalized" && row.status !== "refunded";
            const verdict = live ? words.live : row.winner === null ? words.tied : row.winner.toLowerCase() === you ? words.won : words.lost;
            return (
              <li key={row.matchId}>
                <Link href={`/games/duel/${row.matchId}`} className="du-history-row" data-verdict={live ? "live" : row.winner === null ? "tied" : row.winner.toLowerCase() === you ? "won" : "lost"}>
                  <span className="du-history-verdict">{verdict}</span>
                  <span className="du-history-main">
                    <span className="du-v">{opponent ? shortHex(opponent, 6, 4) : words.noOpponent}</span>
                    <span className="du-k">
                      {row.mode === "free" ? words.free : words.ranked(money(row.potPerPlayerBase), symbol)} · {row.deckSize} {words.cards}
                    </span>
                  </span>
                  <span className="du-history-side">
                    <span className={`du-v ${pnl && BigInt(pnl) > 0n ? "du-up" : pnl && BigInt(pnl) < 0n ? "du-down" : ""}`}>{pnl === null ? "—" : `${BigInt(pnl) > 0n ? "+" : BigInt(pnl) < 0n ? "−" : ""}${money(BigInt(pnl) < 0n ? String(-BigInt(pnl)) : pnl)} ${symbol}`}</span>
                    <span className="du-k">{nowMs > 0 && row.createdAtMs > 0 ? timeAgo(row.createdAtMs, nowMs) : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Pager pager={pager} className="du-pager" />
        </>
      )}
    </div>
  );
}
