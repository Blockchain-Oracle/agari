import { RANGE_NOT_DEPLOYED, type RangeReserveState } from "@agari/core/range";
import { isOk, type Reading } from "@agari/core/schemas";
import { useRangeReserve } from "@agari/markets/react";
import { GAMES } from "@/features/games/copy";
import { searchingNow, useRoomOccupancy } from "@/features/games/duel/useRoomOccupancy";
import { useSeason } from "@/features/games/duel/useSeason";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { diagnosisCopy } from "@/lib/copy";
import type { GameEntry } from "~/features/games/shell";

/**
 * web's `GameCard` status union: `pending` is a build fact, `unavailable` a live chain fact with its reason,
 * `after-hours` playable only on the 24/7 lanes while the stock market is shut.
 */
export type CardStatus =
  | { kind: "pending"; dependency: string }
  | { kind: "loading" }
  | { kind: "live" }
  | { kind: "after-hours"; note: string }
  | { kind: "unavailable"; why: string };

/**
 * Everything `GamesHub` reads before it draws a card: the range reserve (Range and Moonshot share it), the
 * duel room's occupancy (no wallet, no signature), the market session, and the season. The same web hooks.
 */
export function useHubStatus() {
  const reserve = useRangeReserve();
  const occupancy = useRoomOccupancy();
  const season = useSeason();
  const session = useMarketSession();
  const closed = session !== null && !session.open;

  const presence = (entry: GameEntry): string | null => {
    if (entry.id !== "duel" || !occupancy) return null;
    if (!occupancy.reachable) return GAMES.card.roomDown;
    const searching = searchingNow(occupancy);
    if (searching > 0) return GAMES.card.searching(searching);
    return occupancy.pairing > 0 ? GAMES.card.inMatch(occupancy.pairing) : GAMES.card.nobody;
  };

  const status = (entry: GameEntry): CardStatus => {
    const base: CardStatus =
      entry.id === "range" || entry.id === "moonshot"
        ? rangeStatus(reserve)
        : entry.readiness.kind === "built"
          ? { kind: "live" }
          : { kind: "pending", dependency: entry.readiness.dependency };
    // Every mode that plays a Window runs on the 24/7 lanes alone while the stock market is shut; arcade never touches one.
    if (closed && base.kind === "live" && entry.descriptor.group !== "arcade") {
      return { kind: "after-hours", note: GAMES.card.afterHours(session?.label ?? "") };
    }
    return base;
  };

  return { season, status, presence };
}

/** Range and Moonshot sit on one contract, so their cards report the contract. */
function rangeStatus(reading: Reading<RangeReserveState | null> | null): CardStatus {
  if (reading === null) return { kind: "loading" };
  if (!isOk(reading)) return { kind: "unavailable", why: diagnosisCopy(reading.error.kind).headline };
  if (reading.value === null) return { kind: "unavailable", why: RANGE_NOT_DEPLOYED };
  if (reading.value.paused) return { kind: "unavailable", why: GAMES.card.paused };
  return { kind: "live" };
}
