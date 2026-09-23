import { webEnv } from "@/lib/env";

/**
 * GET `<indexer>/<path>` → rows, for a browser island that needs the index's raw rows (prints included) rather than the
 * markets port's mapped shapes. A configured path (`/api/index`) resolves against the page. Throws on a non-2xx, which
 * `useReadingQuery` turns into an `indexer-down` reading.
 */
export async function indexGet<T>(path: string): Promise<T[]> {
  const base = (webEnv.markets.indexerUrl ?? "").replace(/\/$/, "");
  const response = await fetch(`${base}/${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`index ${response.status}`);
  return ((await response.json()) as { rows: T[] }).rows;
}

export const indexConfigured = (): boolean => Boolean(webEnv.markets.indexerUrl);
