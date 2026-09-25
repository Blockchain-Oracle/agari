import { NextResponse, type NextRequest } from "next/server";
import { publicOrigin } from "@/lib/client-ip.server";
import { regionRestricted, regionRestrictedResponse } from "@/lib/region.server";
import { readXConfig } from "@/features/x/config.server";
import { authenticateUrl, requestToken } from "@/features/x/oauth.server";
import { X_OAUTH_COOKIES, X_OAUTH_TTL_SEC } from "@/features/x/session.server";

export const dynamic = "force-dynamic";

/**
 * "Sign in with X": OAuth 1.0a. A request token bound to our callback goes into short-lived httpOnly
 * cookies, then a redirect to X's authenticate page. `?return=/path` says where the callback lands
 * (default `/trade-from-x`). The reference's origin guard is kept: the cookies must be written on the
 * origin that receives the callback, or X appears to succeed and the page asks again.
 *
 * The guard compares hosts, not origins: behind Cloudflare the server speaks http while the callback is
 * https, and an origin compare redirected `/api/x/start` to itself forever (ERR_TOO_MANY_REDIRECTS,
 * 2026-09-24). Cookies are scoped by host, so the host is what the guard protects.
 */
export async function GET(req: NextRequest) {
  // The geofence comes before any key, balance or co-signature (D-095).
  if (regionRestricted(req)) return regionRestrictedResponse();
  const origin = publicOrigin(req);
  const reading = readXConfig(origin);
  if (!reading.configured) return NextResponse.json({ configured: false, missing: reading.missing });
  const { config } = reading;

  const ret = req.nextUrl.searchParams.get("return");
  const safeRet = ret && ret.startsWith("/") && !ret.startsWith("//") ? ret : "";

  const callback = new URL(config.redirectUri);
  if (new URL(origin).host !== callback.host) {
    const canonical = new URL("/api/x/start", callback.origin);
    if (safeRet) canonical.searchParams.set("return", safeRet);
    return NextResponse.redirect(canonical);
  }

  const token = await requestToken({ consumerKey: config.consumerKey, consumerSecret: config.consumerSecret }, config.redirectUri);
  if ("error" in token) {
    console.error("X request token failed", { status: token.status, error: token.error });
    return NextResponse.json({ configured: true, error: "request_token", status: token.status }, { status: 502 });
  }

  const res = NextResponse.redirect(authenticateUrl(token.oauthToken));
  const opts = { httpOnly: true, secure: callback.protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: X_OAUTH_TTL_SEC };
  res.cookies.set(X_OAUTH_COOKIES.token, token.oauthToken, opts);
  res.cookies.set(X_OAUTH_COOKIES.secret, token.oauthTokenSecret, opts);
  if (safeRet) res.cookies.set(X_OAUTH_COOKIES.ret, safeRet, opts);
  return res;
}
