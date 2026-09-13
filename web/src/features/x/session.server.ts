import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The "Sign in with X" session — a port of the reference's `lib/claimOAuth.ts`.
 *
 * The HMAC-signed cookie carries the X authorId the bind route trusts precisely BECAUSE it is
 * signed; a public fallback key would let anyone mint a session for any handle and bind someone
 * else's account to their own wallet. There is no safe default for a key whose whole job is
 * being unguessable, so a missing `X_SESSION_SECRET` refuses.
 */
const b64url = (b: Buffer) => b.toString("base64url");

/** 30 days, as the reference settled on: a one-shot claim tolerates 30 minutes, a portfolio card does not. */
export const X_SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
export const X_SESSION_COOKIE = "x_sess";
/** The OAuth 1.0a request token and its secret live in httpOnly cookies between the start and the callback. */
export const X_OAUTH_COOKIES = { token: "x_rt", secret: "x_rs", ret: "x_ret" } as const;
export const X_OAUTH_TTL_SEC = 600;

export interface XSession {
  authorId: string;
  handle: string | null;
  t: number;
}

export function signSession(secret: string, payload: XSession): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** The session this cookie proves, or null — expired, forged, or malformed all read the same. */
export function readSession(secret: string, token: string | undefined): XSession | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".") as [string, string];
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("base64url"));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as Partial<XSession>;
    if (typeof parsed.authorId !== "string" || !parsed.authorId) return null;
    if (typeof parsed.t === "number" && Date.now() - parsed.t > X_SESSION_TTL_MS) return null;
    return { authorId: parsed.authorId, handle: typeof parsed.handle === "string" ? parsed.handle : null, t: parsed.t ?? 0 };
  } catch {
    return null;
  }
}
