/**
 * Where the indexer API lives for this caller. A configured path (`/api/index`) is same-origin: in the browser it
 * resolves against the page, so the app works on any host or port without cross-origin calls; on the server (SSR,
 * route handlers) it is this Next process over loopback (`next dev|start` sets `PORT`), or `AGARI_INDEXER_INTERNAL_URL`.
 */
export function indexerBase(configured: string): string {
  const trimmed = configured.replace(/\/$/, "");
  if (!trimmed.startsWith("/")) return trimmed;
  // `globalThis.location` exists only in a browser page; the ops service compiles this file without DOM types.
  const pageOrigin = (globalThis as { location?: { origin?: string } }).location?.origin;
  if (pageOrigin) return `${pageOrigin}${trimmed}`;
  const internal = process.env.AGARI_INDEXER_INTERNAL_URL;
  if (internal) return internal.replace(/\/$/, "");
  return `http://127.0.0.1:${process.env.PORT ?? "3000"}${trimmed}`;
}
