import { NextResponse, type NextRequest } from "next/server";
import { COUNTRY_HEADER, isRestrictedCountry, REGION_COOKIE, REGION_HEADER, RESTRICTED } from "@/lib/region-mark";

/**
 * The geofence (D-095). Next 16 replaced `middleware.ts` with this file and the export is named `proxy`.
 *
 * Vercel stamps `x-vercel-ip-country` on every request. A restricted country — or `AGARI_REGION_OVERRIDE`
 * locally, so the state can be walked without a VPN — forwards `x-agari-region: restricted` to the route
 * handlers and leaves a readable `agari.region` cookie so the funded CTAs paint their disabled state on
 * the first frame instead of flashing a live control. Anything else clears the cookie, so a visitor who
 * leaves a restricted region stops being held as soon as their next document loads.
 *
 * Nothing here redirects or blocks a page: reading Agari is open everywhere.
 */

/** A day: long enough to survive a session, short enough that a stale verdict expires on its own. */
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24;

export function proxy(request: NextRequest): NextResponse {
  const restricted =
    isRestrictedCountry(request.headers.get(COUNTRY_HEADER)) || isRestrictedCountry(process.env.AGARI_REGION_OVERRIDE);

  if (!restricted) {
    const open = NextResponse.next();
    if (request.cookies.has(REGION_COOKIE)) open.cookies.delete({ name: REGION_COOKIE, path: "/" });
    return open;
  }

  const headers = new Headers(request.headers);
  headers.set(REGION_HEADER, RESTRICTED);
  const held = NextResponse.next({ request: { headers } });
  held.cookies.set({
    name: REGION_COOKIE,
    value: RESTRICTED,
    path: "/",
    sameSite: "lax",
    // Deliberately readable: `useRegionRestricted()` renders the disabled CTAs from it.
    httpOnly: false,
    maxAge: COOKIE_MAX_AGE_SEC,
  });
  return held;
}

/**
 * Everything but the static payloads: `/api` is matched on purpose, because the funded routes read the
 * header this proxy sets. The extension list covers `web/public` — fonts, sounds, the demo video, the
 * wallet and asset marks, the manifest — none of which should pay for a proxy hop.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|mp3|wav|mp4|webm|txt|xml|json)$).*)",
  ],
};
