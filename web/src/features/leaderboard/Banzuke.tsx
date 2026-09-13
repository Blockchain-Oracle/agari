import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { LEADERBOARD } from "./copy";
import { glyphFromAddress } from "./glyph";
import type { BoardRanking } from "./protocol";

interface Cell {
  glyph: string;
  name: string;
  pnlBase: bigint;
  meta: string;
}

interface Row {
  rank: number;
  label: string;
  tier: 3 | 4 | 5;
  east: Cell | null;
  west: Cell | null;
}

const PODIUM = 3;
const FIELD_END = 50;

function tierOf(rank: number): Row["tier"] {
  if (rank <= 7) return 3;
  if (rank <= 12) return 4;
  return 5;
}

function cellOf(t: BoardRanking, rank: number): Cell {
  return { glyph: glyphFromAddress(t.owner), name: shortHex(t.owner), pnlBase: t.pnlBase, meta: LEADERBOARD.field.cellMeta(rank, t.tradeCount, t.winRatePct) };
}

/** Ranks four onward, two to a row (east and west), in the reference's tiers. The podium already owns ranks 1–3. */
export function banzukeRows(rankings: readonly BoardRanking[]): Row[] {
  const field = rankings.slice(PODIUM, FIELD_END);
  const rows: Row[] = [];
  for (let i = 0; i < field.length; i += 2) {
    const eastRank = i + PODIUM + 1;
    const westRank = eastRank + 1;
    const east = field[i];
    const west = field[i + 1];
    rows.push({
      rank: eastRank,
      label: west ? `${eastRank}-${westRank}` : String(eastRank),
      tier: tierOf(eastRank),
      east: east ? cellOf(east, eastRank) : null,
      west: west ? cellOf(west, westRank) : null,
    });
  }
  return rows;
}

function Pnl({ value, decimals }: { value: bigint; decimals: number }) {
  return (
    <span className="bz-pnl">
      {value >= 0n ? "+" : ""}
      {formatBaseUnits(value, decimals)}
    </span>
  );
}

export function Banzuke({ rows, decimals }: { rows: readonly Row[]; decimals: number }) {
  const words = LEADERBOARD.field;
  return (
    <div className="banzuke-wrap">
      <div className="banzuke-strip">
        <span>{words.strip.ranks}</span>
        <span className="center">{words.strip.center}</span>
        <span>{words.strip.right}</span>
      </div>
      <div className="banzuke-cols-head">
        <div className="east">{words.heads.east}</div>
        <div className="center">{words.heads.center}</div>
        <div className="west">{words.heads.west}</div>
      </div>
      <div>
        {rows.map((row, i) => {
          const previous = i > 0 ? (rows[i - 1] as Row).tier : row.tier;
          return (
            <div key={row.rank}>
              {i > 0 && row.tier !== previous && row.tier === 4 && <div className="bz-divider">{words.dividers.rankAndFile}</div>}
              {i > 0 && row.tier !== previous && row.tier === 5 && <div className="bz-divider">{words.dividers.longTail}</div>}
              <div className={`banzuke-row tier-${row.tier}`}>
                {row.east ? (
                  <div className="bz-cell east" data-cursor="hover">
                    <span className="bz-meta">{row.east.meta}</span>
                    <Pnl value={row.east.pnlBase} decimals={decimals} />
                    <div className="bz-text">
                      <span className="bz-name">{row.east.name}</span>
                    </div>
                    <div className="bz-portrait">{row.east.glyph}</div>
                  </div>
                ) : (
                  <div className="bz-cell east" />
                )}
                <div className="center">{row.label}</div>
                {row.west ? (
                  <div className="bz-cell west" data-cursor="hover">
                    <div className="bz-portrait">{row.west.glyph}</div>
                    <div className="bz-text">
                      <span className="bz-name">{row.west.name}</span>
                    </div>
                    <Pnl value={row.west.pnlBase} decimals={decimals} />
                    <span className="bz-meta">{row.west.meta}</span>
                  </div>
                ) : (
                  <div className="bz-cell west" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
