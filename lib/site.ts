function origin(value: string | undefined, fallback: string) {
  const url = new URL(value || fallback);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Site origins must use HTTP or HTTPS.');
  return url.origin;
}
// Agari has no deployed app domain and no public GitHub repository yet (Q-S15-1, Q-007 in
// docs/plan/decisions.md of the main Agari tree). These are honest placeholders, not live
// addresses: NEXT_PUBLIC_DOCS_URL / NEXT_PUBLIC_APP_URL override them once real ones exist.
export const site = {
  name: 'Agari',
  docs: origin(process.env.NEXT_PUBLIC_DOCS_URL, 'http://localhost:3153'),
  app: origin(process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000'),
  source: null as string | null, // no GitHub remote configured for the Agari tree yet
  revision: null as string | null,
  reviewed: '2026-09-15',
};
export function appUrl(path = '/markets') { return new URL(path, site.app).toString(); }
export function sourceUrl(path: string): string | null {
  return site.source && site.revision ? `${site.source}/blob/${site.revision}/${path}` : null;
}
