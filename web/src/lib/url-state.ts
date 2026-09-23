/**
 * The one way web code rewrites the address without navigating (`?m=&dir=`, a successor Window). A seam so the
 * native app, which has no address bar, can map the same write onto its router (mobile/src/web-shims/url-state.ts).
 */
export function replaceUrl(url: string): void {
  window.history.replaceState(null, "", url);
}
