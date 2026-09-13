import { createHmac, randomBytes } from "node:crypto";

/**
 * OAuth 1.0a signing for X's sign-in — server only. RFC 5849 §3.4: percent-encode per RFC 3986, sort
 * the parameters, sign the base string with HMAC-SHA1 under `consumerSecret&tokenSecret`. The
 * three-legged flow (`oauth/request_token` → `oauth/authenticate` → `oauth/access_token`) is the one
 * part of X's API a deprecated Free-plan app may still use, and its last step answers with the
 * user's id and handle — no profile read needed (2026-09-05).
 */
export interface OAuth1Consumer {
  consumerKey: string;
  consumerSecret: string;
}

/** RFC 3986 unreserved set only — `encodeURIComponent` leaves `!'()*` alone, OAuth does not. */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signatureBaseString(method: "GET" | "POST", baseUrl: string, params: Record<string, string>): string {
  const pairs = Object.entries(params)
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${method}&${percentEncode(baseUrl)}&${percentEncode(pairs)}`;
}

export function oauth1Signature(consumer: OAuth1Consumer, tokenSecret: string, method: "GET" | "POST", baseUrl: string, params: Record<string, string>): string {
  const key = `${percentEncode(consumer.consumerSecret)}&${percentEncode(tokenSecret)}`;
  return createHmac("sha1", key).update(signatureBaseString(method, baseUrl, params)).digest("base64");
}

/**
 * The `Authorization: OAuth …` header for one request. `extra` are OAuth parameters beyond the
 * standard set (`oauth_callback`, `oauth_token`, `oauth_verifier`); `query` are the URL's own.
 */
export function oauth1Header(
  consumer: OAuth1Consumer,
  method: "GET" | "POST",
  baseUrl: string,
  extra: Record<string, string> = {},
  tokenSecret = "",
  query: Record<string, string> = {},
  fresh: { nonce?: string; timestampSec?: number } = {},
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: consumer.consumerKey,
    oauth_nonce: fresh.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(fresh.timestampSec ?? Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
    ...extra,
  };
  const signature = oauth1Signature(consumer, tokenSecret, method, baseUrl, { ...query, ...oauth });
  const header = Object.entries({ ...oauth, oauth_signature: signature })
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(", ");
  return `OAuth ${header}`;
}
