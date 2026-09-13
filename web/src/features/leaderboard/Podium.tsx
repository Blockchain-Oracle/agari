import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { LEADERBOARD } from "./copy";
import { glyphFromAddress } from "./glyph";
import type { BoardRanking } from "./protocol";

type Spot = BoardRanking & { r: 1 | 2 | 3 };

/** [2nd, 1st, 3rd] — the podium's own order, as the reference lays it out. */
export function podiumOrder(rankings: readonly BoardRanking[]): Spot[] {
  if (rankings.length < 3) return rankings.map((t, i) => ({ ...t, r: (i + 1) as 1 | 2 | 3 }));
  return [
    { ...(rankings[1] as BoardRanking), r: 2 },
    { ...(rankings[0] as BoardRanking), r: 1 },
    { ...(rankings[2] as BoardRanking), r: 3 },
  ];
}

export function Podium({ spots, decimals, symbol }: { spots: readonly Spot[]; decimals: number; symbol: string }) {
  const words = LEADERBOARD.podium;
  return (
    <div className="podium">
      {spots.map((p) => (
        <div key={p.r} className={`podium-spot s${p.r}`} data-cursor="hover">
          <span className="podium-rank">{p.r}</span>
          {p.r === 1 && <span className="sash">{words.sash}</span>}
          <div className="podium-eyebrow">
            <span className="ord">{words.ordinals[p.r]}</span>
            <span>{p.r === 1 ? words.streak(p.bestStreak) : p.r === 2 ? words.challenger : words.contender}</span>
          </div>
          <div className="podium-portrait">{glyphFromAddress(p.owner)}</div>
          <div className="podium-name">{shortHex(p.owner)}</div>
          <div className="podium-pnl">
            <span className="sign">{p.pnlBase >= 0n ? "+" : ""}</span>
            {formatBaseUnits(p.pnlBase, decimals)}
            <span className="cur">{symbol}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
