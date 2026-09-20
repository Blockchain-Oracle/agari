"use client";

import { achievementsEarned, type Achievement } from "@agari/core/games";
import { useEffect, useState } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { GAMES } from "./copy";
import "./games.css";

interface Shelf {
  configured: boolean;
  achievements: readonly Achievement[];
  earned: number;
}

/**
 * What this wallet has earned, and what the rest take.
 *
 * Every badge follows from a record that already exists — a duel the arena settled, a rating the settler verified, a
 * score the room vouched for, a Lucky Draw the venue resolved — so the shelf can never claim something the chain and
 * the store do not. A locked badge names what it takes rather than hiding, which is what makes the shelf worth
 * looking at before the first one is earned.
 */
export function AchievementsPlate() {
  const { address } = useWalletSession();
  const [shelf, setShelf] = useState<Shelf | null>(null);

  useEffect(() => {
    let live = true;
    const url = address ? `/api/games/achievements?wallet=${address}` : "/api/games/achievements";
    fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<Shelf>) : null))
      .then((next) => { if (live && next) setShelf(next); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [address]);

  const list = shelf?.achievements ?? [];
  const earned = shelf ? achievementsEarned(list) : 0;
  return (
    <div className="gm-plate">
      <p className="gm-plate-title">{GAMES.achievements.title}</p>
      <p className="gm-plate-body">{shelf?.configured === false ? GAMES.achievements.noStore : address ? GAMES.achievements.body : GAMES.achievements.connect}</p>
      {list.length > 0 && (
        <>
          <p className="gm-plate-meta">{GAMES.achievements.count(earned, list.length)}</p>
          <ul className="gm-ach-list">
            {list.map((badge) => (
              <li key={badge.id} className={badge.earned ? "gm-ach gm-ach--on" : "gm-ach"}>
                <span className="gm-ach-title">{badge.title}</span>
                <span className="gm-ach-how">{badge.how}</span>
                {badge.need > 1 && !badge.earned && <span className="gm-ach-progress">{badge.have} / {badge.need}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
