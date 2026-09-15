/**
 * Where "Docs" points. The documentation is a separate application, so a deployment sets its public URL
 * with `NEXT_PUBLIC_DOCS_URL`. Until the Agari docs host is decided (Q-S15-1) the default is the in-app
 * `/how-it-works` page: nothing links to a host Agari does not run, and since that page has no deep
 * guides, every docs path lands on it rather than on a 404.
 */
const IN_APP_DOCS = "/how-it-works";

const configured = process.env.NEXT_PUBLIC_DOCS_URL?.trim().replace(/\/+$/, "") || null;

export const DOCS_URL = configured ?? IN_APP_DOCS;

/** Resolve a documentation page beneath the configured site, including any base path. */
export function docsUrl(path = ""): string {
  if (!configured) return IN_APP_DOCS;
  return path ? `${configured}/${path.replace(/^\/+/, "")}` : configured;
}
