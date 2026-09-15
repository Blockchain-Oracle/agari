"use client";

import type { Address } from "@agari/core/types";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import Link from "next/link";
import { useMemo } from "react";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import { glyphFromAddress } from "@/features/leaderboard/glyph";
import type { BoardRanking } from "@/features/leaderboard/protocol";
import { useLeaderboard } from "@/features/leaderboard/useLeaderboard";
import { profileHref } from "@/features/takes/cashtags";
import { cn } from "@/lib/utils";
import { useWalletSession } from "@/lib/wallet-session";
import { SOCIAL } from "./copy";
import { useFollows } from "./useFollows";
import "./social.css";

interface Friend {
  rank: number;
  trader: BoardRanking;
  you: boolean;
}

function Cell({ friend, side, decimals }: { friend: Friend | undefined; side: "east" | "west"; decimals: number }) {
  if (!friend) return <div className={cn("bz-cell", side)} />;
  const words = SOCIAL.friends;
  const { trader } = friend;
  const pnl = (
    <span className="bz-pnl">
      {trader.pnlBase >= 0n ? "+" : ""}
      {formatBaseUnits(trader.pnlBase, decimals)}
    </span>
  );
  const meta = <span className="bz-meta">{words.cellMeta(trader.tradeCount, trader.winRatePct)}</span>;
  const text = (
    <div className="bz-text">
      <Link href={profileHref(trader.owner)} className="bz-name" data-cursor="hover">
        {friend.you ? `${words.you} · ${shortHex(trader.owner)}` : shortHex(trader.owner)}
      </Link>
    </div>
  );
  const portrait = <div className="bz-portrait">{glyphFromAddress(trader.owner)}</div>;
  return (
    <div className={cn("bz-cell", side, friend.you && "is-you")}>
      {side === "east" ? (
        <>
          {meta}
          {pnl}
          {text}
          {portrait}
        </>
      ) : (
        <>
          {portrait}
          {text}
          {pnl}
          {meta}
        </>
      )}
    </div>
  );
}

/**
 * The Friends board (spec §1.6): the leaderboard payload already cached under `LEADERBOARD_KEY`, filtered to the
 * wallets you follow and yourself. It adds no scan: the 24-hour ranking is the one `/leaderboard` reads, and the
 * follow graph is the one cached for your profile. Laid out as the Banzuke — two accounts a row, east and west, with
 * each pair's global ranks in the centre column — so a friend's line reads exactly as it does on the full board.
 *
 * S5 owns `/leaderboard`; this component is exported for its Friends tab (Q-S13-8) and shown on `/activity`.
 */
export function FriendsBoard() {
  const { address } = useWalletSession();
  const follows = useFollows(address);
  // The venue day, as S5's own Friends tab reads it (`LeaderboardBoard.tsx` VENUE_DAY).
  const board = useLeaderboard({ period: "24h", ticker: null });
  const data = board?.ok ? board.value : null;
  const words = SOCIAL.friends;

  const friends = useMemo<Friend[]>(() => {
    if (!data || !follows.data || !address) return [];
    const circle = new Set<Address>([...follows.data.following, address]);
    return data.rankings.flatMap((trader, index) => (circle.has(trader.owner) ? [{ rank: index + 1, trader, you: trader.owner === address }] : []));
  }, [data, follows.data, address]);

  const pairs = useMemo(() => {
    const rows: [Friend, Friend | undefined][] = [];
    for (let i = 0; i < friends.length; i += 2) rows.push([friends[i] as Friend, friends[i + 1]]);
    return rows;
  }, [friends]);

  if (!address) return <p className="soc-board-state">{words.connect}</p>;
  // The board's own failure words: a board that can't be computed is not a quiet circle of friends.
  if (!data && board !== null && !board.ok) {
    return (
      <p className="soc-board-state" role="alert">
        {LEADERBOARD.failed}
      </p>
    );
  }
  if (!data || !follows.data) {
    return (
      <p className="soc-board-state" role="status" aria-busy="true">
        {words.loading}
      </p>
    );
  }
  if (follows.data.following.length === 0) {
    return (
      <p className="soc-board-state">
        <strong>{words.none.headline}</strong>
        {words.none.body}
      </p>
    );
  }
  if (friends.every((friend) => friend.you)) {
    return (
      <p className="soc-board-state">
        <strong>{words.quiet.headline}</strong>
        {words.quiet.body}
      </p>
    );
  }

  return (
    <div className="banzuke-wrap soc-board">
      <div className="banzuke-strip">
        <span>{words.strip.left(friends.length)}</span>
        <span className="center">{words.strip.center}</span>
        <span>{words.strip.right}</span>
      </div>
      <div>
        {pairs.map(([east, west]) => (
          <div key={east.trader.owner} className="banzuke-row tier-3">
            <Cell friend={east} side="east" decimals={data.meta.decimals} />
            <div className="center">{west ? `${east.rank}·${west.rank}` : east.rank}</div>
            <Cell friend={west} side="west" decimals={data.meta.decimals} />
          </div>
        ))}
      </div>
    </div>
  );
}
