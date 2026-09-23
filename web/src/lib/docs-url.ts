/**
 * Where "Docs" points: the Agari docs site (`docs-site/`, served at docs.useagari.xyz since S25.1). The documentation is
 * a separate application, so a deployment may point elsewhere with `NEXT_PUBLIC_DOCS_URL`; every `/docs/*` bookmark
 * lands on the same path there.
 */
const DOCS_ORIGIN = "https://docs.useagari.xyz";

const configured = process.env.NEXT_PUBLIC_DOCS_URL?.trim().replace(/\/+$/, "") || null;

export const DOCS_URL = configured ?? DOCS_ORIGIN;

/** Resolve a documentation page beneath the docs site, including any base path. */
export function docsUrl(path = ""): string {
  return path ? `${DOCS_URL}/${path.replace(/^\/+/, "")}` : DOCS_URL;
}
