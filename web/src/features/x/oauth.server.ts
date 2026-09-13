import { type OAuth1Consumer, oauth1Header } from "./oauth1.server";

/**
 * "Sign in with X" as the three-legged OAuth 1.0a flow — the one X still serves a deprecated
 * Free-plan app (2026-09-05). Its last step answers with `user_id` and `screen_name` itself, so no
 * profile read follows; the OAuth 2.0 flow the reference used needed `GET /2/users/me`, a v2 endpoint
 * that plan refuses, and X's own `oauth/authenticate` page is the same consent screen either way.
 */
const REQUEST_TOKEN_URL = "https://api.x.com/oauth/request_token";
const ACCESS_TOKEN_URL = "https://api.x.com/oauth/access_token";
const AUTHENTICATE_URL = "https://api.x.com/oauth/authenticate";

export interface RequestToken {
  oauthToken: string;
  oauthTokenSecret: string;
}

/** Step one: a temporary token bound to our callback. `oauth_callback_confirmed` must come back true. */
export async function requestToken(consumer: OAuth1Consumer, callbackUrl: string): Promise<RequestToken | { error: string; status: number }> {
  const response = await fetch(REQUEST_TOKEN_URL, {
    method: "POST",
    headers: { authorization: oauth1Header(consumer, "POST", REQUEST_TOKEN_URL, { oauth_callback: callbackUrl }) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) return { error: text.slice(0, 120), status: response.status };
  const params = new URLSearchParams(text);
  const oauthToken = params.get("oauth_token");
  const oauthTokenSecret = params.get("oauth_token_secret");
  if (!oauthToken || !oauthTokenSecret || params.get("oauth_callback_confirmed") !== "true") return { error: "callback not confirmed", status: response.status };
  return { oauthToken, oauthTokenSecret };
}

/** Step two: where the browser goes to approve. `authenticate` (not `authorize`) skips re-asking a user who already approved. */
export function authenticateUrl(oauthToken: string): string {
  const url = new URL(AUTHENTICATE_URL);
  url.searchParams.set("oauth_token", oauthToken);
  return url.toString();
}

export interface XIdentity {
  id: string;
  username: string | null;
}

/** Step three: the verifier X sent back becomes the account's identity. The access token itself is not kept — the site never acts as the user. */
export async function accessToken(consumer: OAuth1Consumer, token: RequestToken, verifier: string): Promise<XIdentity | { error: string; status: number }> {
  const response = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: oauth1Header(consumer, "POST", ACCESS_TOKEN_URL, { oauth_token: token.oauthToken, oauth_verifier: verifier }, token.oauthTokenSecret),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ oauth_verifier: verifier }),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) return { error: text.slice(0, 120), status: response.status };
  const params = new URLSearchParams(text);
  const id = params.get("user_id");
  if (!id) return { error: "no user_id in the access token answer", status: response.status };
  return { id, username: params.get("screen_name") };
}
