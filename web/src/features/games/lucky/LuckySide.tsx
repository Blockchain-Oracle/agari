"use client";

import { LUCKY_VERIFIED } from "@masayume/core/games";
import { shortHex } from "@masayume/core/units";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGames } from "../GamesProvider";
import { LUCKY } from "./copy";
import { LuckyResultModal } from "./LuckyResultModal";
import type { LuckyRowWire } from "./lucky-wire";
import { luckyLoseSting, luckyWinSting } from "./reel-sfx";
import { useLuckyBoard, useLuckyHistory } from "./useLuckyHistory";

const BOARD_SHOWN = 5;

export interface LuckySideProps {
  wallet: string | null;
  /** The spin placed in this session, watched so its verdict can be shown the moment the chain gives it. */
  watchDrawId: string | null;
  decimals: number | null;
  symbol: string;
}

/**
 * Beside the cabinet: the mode's own sentence, this wallet's streak, the top of the streak ladder, and
 * the two things a player should know before the first spin. The streak and the ladder count settled
 * spins only — the history read is what settles them — and the ladder is Pips' per-game RANKS.
 *
 * The verdict watcher lives here because this is where the history is already polled: when the spin
 * placed in this session reaches a settled result, the modal opens once, with the verdict's own sting.
 */
export function LuckySide({ wallet, watchDrawId, decimals, symbol }: LuckySideProps) {
  const { feedback } = useGames();
  const { feed } = useLuckyHistory((wallet as `0x${string}` | null) ?? null);
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
    if (row.result === "won") {
      luckyWinSting();
      feedback("card-win");
    } else if (row.result === "lost") {
      luckyLoseSting();
      feedback("card-loss");
    } else feedback("modal-open");
  }, [watchDrawId, feed, feedback]);

  const you = wallet?.toLowerCase() ?? null;
  const words = LUCKY.board;

  return (
    <aside className="lk-side">
      <p className="lk-intro">{LUCKY.intro}</p>

      {feed?.configured && (
        <div className="gm-plate">
          <div className="lk-streak">
            <div className="gm-match-fact">
              <span className="gm-match-k">{LUCKY.history.streak}</span>
              <span className="lk-streak-v">{feed.streak}</span>
            </div>
            <div className="gm-match-fact">
              <span className="gm-match-k">{LUCKY.history.best}</span>
              <span className="lk-streak-v">{feed.best}</span>
            </div>
          </div>
          <Link href="/games/history" className="lk-link">
            {LUCKY.history.title}
          </Link>
        </div>
      )}

      <div className="gm-plate">
        <p className="gm-plate-title">{words.title}</p>
        <p className="gm-plate-body">{words.intro}</p>
        {board === null ? (
          <p className="gm-plate-meta">{words.loading}</p>
        ) : !board.configured ? (
          <p className="gm-plate-meta">{words.notConfigured}</p>
        ) : board.rows.length === 0 ? (
          <p className="gm-plate-meta">{words.empty}</p>
        ) : (
          <ol className="lk-board">
            {board.rows.slice(0, BOARD_SHOWN).map((row, i) => (
              <li key={row.wallet} className="lk-rung" data-you={row.wallet === you ? "" : undefined}>
                <span className="lk-rung-place">{i + 1}</span>
                <span className="lk-rung-main">
                  <span className="du-v">{row.wallet === you ? words.you : shortHex(row.wallet, 6, 4)}</span>
                  <span className="du-k">{words.spins(row.spins)}</span>
                </span>
                <span className="lk-rung-side">
                  <span className="lk-rung-v">{row.streak}</span>
                  <span className="du-k">
                    {words.now} · {words.best} {row.best}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="gm-plate">
        <p className="gm-plate-title">{LUCKY.deal.proof.label}</p>
        <p className="gm-plate-body">{LUCKY.deal.proof.scope}</p>
      </div>
      <div className="gm-plate">
        <p className="gm-plate-body">{LUCKY.deal.honesty}</p>
      </div>

      {shown && <LuckyResultModal open onClose={() => setShown(null)} row={shown} decimals={decimals} symbol={symbol} streak={feed?.streak ?? 0} />}
    </aside>
  );
}
