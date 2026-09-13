import { NextResponse, type NextRequest } from "next/server";
import { readXConfig } from "@/features/x/config.server";
import { authenticateUrl, requestToken } from "@/features/x/oauth.server";
import { X_OAUTH_COOKIES, X_OAUTH_TTL_SEC } from "@/features/x/session.server";

export const dynamic = "force-dynamic";

/**
 * "Sign in with X": OAuth 1.0a. A request token bound to our callback goes into short-lived httpOnly
 * cookies, then a redirect to X's authenticate page. `?return=/path` says where the callback lands
 * (default `/trade-from-x`). The reference's origin guard is kept: the cookies must be written on the
 * origin that receives the callback, or X appears to succeed and the page asks again.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const reading = readXConfig(origin);
  if (!reading.configured) return NextResponse.json({ configured: false, missing: reading.missing });
  const { config } = reading;

  const ret = req.nextUrl.searchParams.get("return");
  const safeRet = ret && ret.startsWith("/") && !ret.startsWith("//") ? ret : "";

  const callbackOrigin = new URL(config.redirectUri).origin;
  if (origin !== callbackOrigin) {
    const canonical = new URL("/api/x/start", callbackOrigin);
    if (safeRet) canonical.searchParams.set("return", safeRet);
    return NextResponse.redirect(canonical);
  }

  const token = await requestToken({ consumerKey: config.consumerKey, consumerSecret: config.consumerSecret }, config.redirectUri);
  if ("error" in token) {
    console.error("X request token failed", { status: token.status, error: token.error });
    return NextResponse.json({ configured: true, error: "request_token", status: token.status }, { status: 502 });
  }

  const res = NextResponse.redirect(authenticateUrl(token.oauthToken));
  const opts = { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax" as const, path: "/", maxAge: X_OAUTH_TTL_SEC };
  res.cookies.set(X_OAUTH_COOKIES.token, token.oauthToken, opts);
  res.cookies.set(X_OAUTH_COOKIES.secret, token.oauthTokenSecret, opts);
  if (safeRet) res.cookies.set(X_OAUTH_COOKIES.ret, safeRet, opts);
  return res;
}
