/**
 * The geofence's shared vocabulary (D-095), runtime-agnostic on purpose: the proxy, the route handlers
 * and the browser all read these marks, and a React import here would keep `proxy.ts` and every funded
 * route out of the server graph. The hook lives beside it in `region.ts`.
 *
 * A restricted visitor browses everything and funds nothing: markets, proof, news and portfolio reads
 * stay open, while the ticket, the schedule, the faucet, the sponsor, the private desk and
 * trade-from-x render their disabled state instead of a control that would take money.
 */

/** Vercel stamps this on every request; it is the only country signal the proxy trusts. */
export const COUNTRY_HEADER = "x-vercel-ip-country";

/** Stamped on the forwarded request by the proxy, so a route handler never re-derives the verdict. */
export const REGION_HEADER = "x-agari-region";

/** Readable by the client on purpose: the funded CTAs paint their restricted state on the first frame. */
export const REGION_COOKIE = "agari.region";

export const RESTRICTED = "restricted";

/** ISO 3166-1 alpha-2, uppercased. The list is the user's to change (D-095). */
const RESTRICTED_COUNTRIES = new Set(["US"]);

export function isRestrictedCountry(country: string | null | undefined): boolean {
  return country ? RESTRICTED_COUNTRIES.has(country.trim().toUpperCase()) : false;
}

/**
 * The verdict the proxy left on this browser. Safe to call anywhere: with no `document` — the server
 * render, a worker — it answers `false`, which is the open state, so nothing is hidden by accident.
 */
export function readRegionRestricted(): boolean {
  if (typeof document === "undefined") return false;
  for (const part of document.cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== REGION_COOKIE) continue;
    return decodeURIComponent(part.slice(eq + 1).trim()) === RESTRICTED;
  }
  return false;
}
