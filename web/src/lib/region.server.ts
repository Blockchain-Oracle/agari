import { COUNTRY_HEADER, isRestrictedCountry, REGION_HEADER, RESTRICTED } from "./region-mark";

/**
 * The server half of the geofence (D-095): every funded route answers this before it touches a key,
 * a balance or a co-signature. Reads never call it.
 */

/**
 * The proxy's mark first, because it already holds the country list. The raw geo header and the local
 * override are kept as a fallback so a route stays enforced even if the matcher ever stops covering it.
 * No header and no override means open — local development and ops see the venue unchanged.
 */
export function regionRestricted(req: Request): boolean {
  if (req.headers.get(REGION_HEADER) === RESTRICTED) return true;
  if (isRestrictedCountry(process.env.AGARI_REGION_OVERRIDE)) return true;
  return isRestrictedCountry(req.headers.get(COUNTRY_HEADER));
}

/** 451 Unavailable For Legal Reasons — the venue's whole answer to a funded call from a held region. */
export function regionRestrictedResponse(): Response {
  return Response.json({ error: "region_restricted" }, { status: 451, headers: { "Cache-Control": "no-store" } });
}
