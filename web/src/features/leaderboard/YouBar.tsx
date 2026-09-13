import { formatBaseUnits, shortHex } from "@masayume/core/units";
import Link from "next/link";
import { LEADERBOARD } from "./copy";
import { glyphFromAddress } from "./glyph";
import type { BoardData, BoardRanking } from "./protocol";

interface YouBarProps {
  address: string;
  data: BoardData;
}

/** The sticky vermilion bar: your rank whenever a wallet is connected, with its own Unranked state. */
export function YouBar({ address, data }: YouBarProps) {
  const words = LEADERBOARD.you;
  const owner = address.toLowerCase();
  const index = data.rankings.findIndex((r) => r.owner.toLowerCase() === owner);
  const you: { rank: number; trader: BoardRanking } | null = index === -1 ? null : { rank: index + 1, trader: data.rankings[index] as BoardRanking };
  const ranked = data.meta.rankedTraders;
  const rankedText = ranked > 0 ? ranked.toLocaleString() : LEADERBOARD.dash;
  const pnl = (value: bigint) => `${value >= 0n ? "+" : ""}${formatBaseUnits(value, data.meta.decimals)}`;

  return (
    <div className="you-bar" data-cursor="hover">
      <div className="you-rank">
        <span className="lbl">{words.rank}</span>
        <span>
          <span className="val">{you ? `#${you.rank}` : words.unranked}</span>
          <span className="of">{words.of(rankedText)}</span>
        </span>
      </div>
      <div className="you-info">
        <div className="you-portrait">{glyphFromAddress(owner)}</div>
        <div className="you-text">
          <span className="name">{words.name(shortHex(address))}</span>
          <span className="meta">{you ? words.top(Math.round((you.rank / Math.max(1, ranked)) * 100)) : words.none}</span>
        </div>
      </div>
      <div className="you-stats">
        <div className="item">
          <span className="lbl">{words.net}</span>
          <span className="v">{you ? pnl(you.trader.pnlBase) : LEADERBOARD.dash}</span>
        </div>
        <div className="item">
          <span className="lbl">{words.winRate}</span>
          <span className="v">{you ? `${you.trader.winRatePct}%` : LEADERBOARD.dash}</span>
        </div>
        <div className="item">
          <span className="lbl">{words.streak}</span>
          <span className="v">{you ? String(you.trader.bestStreak).padStart(2, "0") : LEADERBOARD.dash}</span>
        </div>
      </div>
      <Link className="you-cta" href="/portfolio">
        {words.cta}
      </Link>
    </div>
  );
}
