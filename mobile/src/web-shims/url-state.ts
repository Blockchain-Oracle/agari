import { marketIdFromPath, parseMarketsSearch } from "@agari/core/urls";
import { router } from "expo-router";

/** The app's current path, kept by RouteTracker (root layout): web's writes decide from it where they land. */
let currentPath = "/";
export const trackPath = (path: string) => {
  currentPath = path;
};

/**
 * Stands in for web/src/lib/url-state.ts (`history.replaceState`): a Window's address (`/markets?m=<id>&dir=up`, or
 * `/markets/<id>`) is rewritten in place, never navigated to. The open ticket carries its Window as `?m=` (a side switch
 * or the no-entry roll changes the drawer, not the page under it); /markets carries the hero's. Anywhere else the
 * write is dropped: a navigation from here would dismiss whatever dialog is up (the ticket drawer, at a Window roll).
 */
export function replaceUrl(url: string): void {
  const parsed = new URL(url, "https://app.invalid");
  const search = parseMarketsSearch(parsed.searchParams);
  const marketId = marketIdFromPath(parsed.pathname) ?? search.marketId;
  if (!marketId) return;
  const dir = search.dir ? { dir: search.dir } : {};
  if (currentPath === "/ticket" || currentPath === "/markets") router.setParams({ m: marketId, ...dir });
}
