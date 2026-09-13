import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { readXConfig } from "@/features/x/config.server";
import { accessToken } from "@/features/x/oauth.server";
import { X_DEFAULT_RETURN, X_REASON_PARAM, X_RETURN_PARAM } from "@/features/x/protocol";
import { signSession, X_OAUTH_COOKIES, X_SESSION_COOKIE, X_SESSION_TTL_MS } from "@/features/x/session.server";

export const dynamic = "force-dynamic";

/**
 * X redirects here with `?oauth_token&oauth_verifier`. The token must be the one this browser started
 * with; the verifier is exchanged for the account's id and handle, which go into a signed session, and
 * the browser bounces back to the page that started it with `?x=1` — or `?x=err&x_reason=`.
 * Ported from the reference's `api/claim/x/callback`, on OAuth 1.0a since 2026-09-05.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const jar = await cookies();
  const ret = jar.get(X_OAUTH_COOKIES.ret)?.value;
  const home = `${origin}${ret && ret.startsWith("/") && !ret.startsWith("//") ? ret : X_DEFAULT_RETURN}`;
  const withResult = (result: "1" | "err", reason?: string) => {
    const url = new URL(home);
    url.searchParams.set(X_RETURN_PARAM, result);
    if (reason) url.searchParams.set(X_REASON_PARAM, reason);
    return url.toString();
  };

  const reading = readXConfig(origin);
  if (!reading.configured) return NextResponse.redirect(withResult("err", "config"));
  const { config } = reading;

  const oauthToken = req.nextUrl.searchParams.get("oauth_token");
  const verifier = req.nextUrl.searchParams.get("oauth_verifier");
  const savedToken = jar.get(X_OAUTH_COOKIES.token)?.value;
  const savedSecret = jar.get(X_OAUTH_COOKIES.secret)?.value;
  if (!oauthToken || !verifier) return NextResponse.redirect(withResult("err", "denied"));
  if (!savedToken || !savedSecret || oauthToken !== savedToken) return NextResponse.redirect(withResult("err", "state"));

  try {
    const identity = await accessToken({ consumerKey: config.consumerKey, consumerSecret: config.consumerSecret }, { oauthToken: savedToken, oauthTokenSecret: savedSecret }, verifier);
    if ("error" in identity) {
      console.error("X access token failed", { status: identity.status, error: identity.error });
      return NextResponse.redirect(withResult("err", "token"));
    }

    const res = NextResponse.redirect(withResult("1"));
    res.cookies.set(X_SESSION_COOKIE, signSession(config.sessionSecret, { authorId: identity.id, handle: identity.username, t: Date.now() }), {
      httpOnly: true,
      secure: origin.startsWith("https"),
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(X_SESSION_TTL_MS / 1000),
    });
    res.cookies.delete(X_OAUTH_COOKIES.token);
    res.cookies.delete(X_OAUTH_COOKIES.secret);
    res.cookies.delete(X_OAUTH_COOKIES.ret);
    return res;
  } catch (error) {
    console.error("X OAuth callback failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(withResult("err", "server"));
  }
}
