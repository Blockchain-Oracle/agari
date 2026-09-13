import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LinkStep } from "./LinkStep";
import type { XLink } from "./useXStatus";
import type { XStatus } from "./protocol";

const status: XStatus = { configured: true, missing: [], storeConfigured: true, signedIn: false, session: null, binding: null, executor: null, handle: "@masayume_app" };
function render(over: Partial<XLink>) {
  const link: XLink = { status, loading: false, busy: "", error: "", ok: "", needsLink: false, walletMismatch: false,
    sessionMatchesBinding: false, refresh: vi.fn(), link: vi.fn(), unlink: vi.fn(), startUrl: () => "/api/x/start?return=%2Ftrade-from-x",
    setOk: vi.fn(), setError: vi.fn(), ...over };
  return renderToStaticMarkup(createElement(LinkStep, { link, returnTo: "/trade-from-x", enabled: true }));
}

describe("X account linking availability", () => {
  it("renders checking during the initial fetch, then the real sign-in control after status arrives", () => {
    const initial = render({ loading: true, status: null });
    expect(initial).toContain("Checking your X connection");
    expect(initial).not.toMatch(/not configured|unavailable|X_API_KEY|href=/);
    const loaded = render({});
    expect(loaded).toContain("/api/x/start");
    expect(loaded).toContain("Sign in with X");
    expect(loaded).not.toContain("Checking");
  });
  it("shows a user-facing unavailable state for failed or unconfigured reads without leaking setup names", () => {
    for (const missing of [null, { ...status, configured: false, missing: ["X_API_KEY", "X_API_KEY_SECRET", "X_SESSION_SECRET"] }]) {
      const html = render({ status: missing });
      expect(html).toContain("temporarily unavailable");
      expect(html).not.toMatch(/X_API_KEY|X_SESSION_SECRET|href=/);
    }
  });
  it("keeps an established wallet binding visible even when new sign-in is unavailable", () => {
    const html = render({ status: { ...status, configured: false, binding: { authorId: "99", handle: "caller", wallet: `0x${"ab".repeat(20)}`, since: 1 } } });
    expect(html).toContain("@caller routes to this wallet");
    expect(html).not.toContain("unavailable");
  });
});
