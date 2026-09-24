import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauth = vi.hoisted(() => ({
  requestToken: vi.fn(async () => ({ oauthToken: "tok", oauthTokenSecret: "sec" })),
  authenticateUrl: (token: string) => `https://api.x.com/oauth/authenticate?oauth_token=${token}`,
}));
vi.mock("@/features/x/oauth.server", () => oauth);

const { GET } = await import("./route");

const ENV = {
  X_API_KEY: "key",
  X_API_KEY_SECRET: "secret",
  X_SESSION_SECRET: "s".repeat(64),
  X_REDIRECT_URI: "https://useagari.xyz/api/x/callback",
  TRUSTED_PROXY: "cloudflare",
};

/** What the container sees behind Cloudflare → Traefik: plain http, the public host, and maybe the proxy's headers. */
const behindProxy = (url: string, headers: Record<string, string> = {}) => new NextRequest(url, { headers });

describe("GET /api/x/start (the 2026-09-24 redirect loop)", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    oauth.requestToken.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("goes to X when TLS ends at the proxy and no forwarded proto arrives", async () => {
    const res = await GET(behindProxy("http://useagari.xyz/api/x/start?return=/trade-from-x"));
    expect(res.headers.get("location")).toBe("https://api.x.com/oauth/authenticate?oauth_token=tok");
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  it("goes to X when the proxy forwards https", async () => {
    const res = await GET(behindProxy("http://useagari.xyz/api/x/start", { "x-forwarded-proto": "https" }));
    expect(res.headers.get("location")).toMatch(/^https:\/\/api\.x\.com\//);
  });

  it("still moves a browser on another host to the callback's host, once", async () => {
    const res = await GET(behindProxy("https://www.useagari.xyz/api/x/start?return=/trade-from-x"));
    expect(res.headers.get("location")).toBe("https://useagari.xyz/api/x/start?return=%2Ftrade-from-x");
    expect(oauth.requestToken).not.toHaveBeenCalled();
  });
});
