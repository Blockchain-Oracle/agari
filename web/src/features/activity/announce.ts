import type { ActivityItem } from "./protocol";

/**
 * Which inbox events a tab announces, decided purely so the rules can be read in one place.
 *
 * - Nothing that happened before the tab mounted: the first answer only records what is already there.
 * - An event the index recorded late (it lags the chain by seconds) is still announced if it happened at most
 *   `LATE_SEC` before mount and was not in that first answer.
 * - Nothing twice: this tab's `seen` ids, plus the ids any tab already announced (`shared`).
 * - Not a fill this tab sent itself (`localFills`, fed by `recordBet`): the user watched it land.
 * - Not a take: a take is someone's words, not something that happened to you.
 * - A win that is still claimable is one notification, not two.
 */
export const LATE_SEC = 120;
/** Past this many at once (a tab back from a long sleep), the rest are summarised in one line. */
export const ANNOUNCE_MAX = 3;

export interface WatchState {
  mountSec: number;
  baselined: boolean;
  seen: Set<string>;
}

export interface Announcement {
  item: ActivityItem;
  /** A win's claimable payout, folded into the win's own notification. */
  claimBase: string | null;
  /** The ids this one notification announces: the item's, and a folded claimable's. */
  ids: string[];
}

export function selectAnnouncements(
  items: readonly ActivityItem[],
  state: WatchState,
  shared: ReadonlySet<string>,
  localFills: ReadonlySet<string>,
): { announce: Announcement[]; overflow: number } {
  const fresh: ActivityItem[] = [];
  for (const item of [...items].sort((a, b) => a.atSec - b.atSec)) {
    if (state.seen.has(item.id)) continue;
    state.seen.add(item.id);
    if (shared.has(item.id)) continue;
    if (!state.baselined && item.atSec < state.mountSec) continue;
    if (item.atSec < state.mountSec - LATE_SEC) continue;
    if (item.kind === "take") continue;
    if (item.kind === "fill" && item.signature !== null && localFills.has(item.signature)) continue;
    fresh.push(item);
  }
  state.baselined = true;

  const seat = (item: ActivityItem) => `${item.marketId}:${item.wallet}`;
  const wins = new Set(fresh.filter((item) => item.kind === "settled-win").map(seat));
  const claims = new Map(fresh.filter((item) => item.kind === "claimable").map((item) => [seat(item), item]));
  const announce = fresh
    .filter((item) => !(item.kind === "claimable" && wins.has(seat(item))))
    .map((item): Announcement => {
      const claim = item.kind === "settled-win" ? claims.get(seat(item)) : undefined;
      return { item, claimBase: claim?.amountBase ?? null, ids: claim ? [item.id, claim.id] : [item.id] };
    });
  return { announce: announce.slice(-ANNOUNCE_MAX), overflow: Math.max(0, announce.length - ANNOUNCE_MAX) };
}
