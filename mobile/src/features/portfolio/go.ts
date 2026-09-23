import { router, type Href } from "expo-router";

/**
 * Pushes a native route another builder owns (Earn, Trade from X, Trader Edge, a ticker page): typed routes only know
 * the screens that exist in this checkout, so the path is checked by name here rather than by the generated union.
 */
export function go(path: string, params?: Record<string, string>): void {
  router.push((params ? { pathname: path, params } : path) as Href);
}
