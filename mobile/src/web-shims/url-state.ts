import { marketIdFromPath, parseMarketsSearch } from "@agari/core/urls";
import { router } from "expo-router";

/** The app's current path, kept by RouteTracker (root layout): web's writes decide from it where they land. */
let currentPath = "/";
export const trackPath = (path: string) => {
  currentPath = path;
};

/**
 * Stands in for web/src/lib/url-state.ts. A Window's address (`/markets?m=<id>&dir=up`, or `/markets/<id>`) becomes
 * the app's Window route: on a Window screen its params change in place, anywhere else the Window opens.
 */
export function replaceUrl(url: string): void {
  const parsed = new URL(url, "https://app.invalid");
  const search = parseMarketsSearch(parsed.searchParams);
  const marketId = marketIdFromPath(parsed.pathname) ?? search.marketId;
  if (!marketId) return;
  const dir = search.dir ? { dir: search.dir } : {};
  // The ticket sheet carries its Window as ?m=: a side switch there changes the sheet, not the page under it.
  if (currentPath === "/ticket") return router.setParams({ m: marketId, ...dir });
  const params = { id: marketId, ...dir };
  if (marketIdFromPath(currentPath)) router.setParams(params);
  else router.push({ pathname: "/markets/[id]", params });
}
