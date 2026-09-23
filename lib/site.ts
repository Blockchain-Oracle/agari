function origin(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Site origins must use HTTP or HTTPS.');
  return url.origin;
}
// The app is public at useagari.xyz. The docs have no confirmed public URL yet.
// Keep the docs origin local until the separate docs deployment is verified.
export const site = {
  name: 'Agari',
  docs: origin(process.env.NEXT_PUBLIC_DOCS_URL, 'http://localhost:3153'),
  app: origin(process.env.NEXT_PUBLIC_APP_URL, 'https://useagari.xyz'),
  source: null as string | null, // app repository is private
  revision: 'c412501',
  reviewed: '2026-09-23',
};
export function appUrl(path = '/markets') { return new URL(path, site.app).toString(); }
export function sourceUrl(path: string): string | null {
  return site.source && site.revision ? `${site.source}/blob/${site.revision}/${path}` : null;
}
