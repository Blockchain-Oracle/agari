import type { Side } from "@agari/core/types";
import { router } from "expo-router";

/**
 * web's `marketDeepLink` as the app follows it: every UP/DOWN, card, Yes/No and "Open" anywhere goes to
 * `/markets?m=<id>&dir=<side>`, where the page selects that Window into the hero and — with a side, or for any pick
 * made on the page itself (`ticket`, web's session id: a card body, "Schedule a call") — opens the ticket drawer on
 * it. `k` makes a second tap on the same Window a new request.
 */
export function openWindow(marketId: string, side?: Side, ticket = side !== undefined): void {
  const k = String(Date.now());
  const params: Record<string, string> = { m: marketId, k };
  if (side) params.dir = side;
  if (ticket) params.t = "1";
  router.navigate({ pathname: "/markets", params });
}

/** A pick on /markets itself: it always opens the drawer, side or not. */
export const selectWindow = (marketId: string, side?: Side): void => openWindow(marketId, side, true);
