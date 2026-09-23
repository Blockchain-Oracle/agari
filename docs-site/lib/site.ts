function origin(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Site origins must use HTTP or HTTPS.');
  return url.origin;
}
// The app is public at useagari.xyz; the docs are their own Coolify app at docs.useagari.xyz.
export const site = {
  name: 'Agari',
  docs: origin(process.env.NEXT_PUBLIC_DOCS_URL, 'https://docs.useagari.xyz'),
  app: origin(process.env.NEXT_PUBLIC_APP_URL, 'https://useagari.xyz'),
  // The app repository (github.com/Blockchain-Oracle/agari) is private until submission; set it here to turn on the
  // GitHub link, llms.txt's README entry and per-page source notes, all pinned to `revision`.
  source: null as string | null,
  revision: 'c412501',
  reviewed: '2026-09-23',
};
export function appUrl(path = '/markets') { return new URL(path, site.app).toString(); }
export function sourceUrl(path: string): string | null {
  return site.source && site.revision ? `${site.source}/blob/${site.revision}/${path}` : null;
}
