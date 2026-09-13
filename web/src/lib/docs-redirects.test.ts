import { getRedirectUrl, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function responseFor(path: string, docsOrigin?: string) {
  vi.stubEnv("NEXT_PUBLIC_DOCS_URL", docsOrigin);
  vi.resetModules();
  const { default: nextConfig } = await import("../../next.config");
  return unstable_getResponseFromNextConfig({ url: `https://masayume.app${path}`, nextConfig });
}

describe("retired documentation bookmarks", () => {
  it("sends the old docs root to the configured docs site", async () => {
    const response = await responseFor("/docs", "https://docs.example.com");
    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe("https://docs.example.com/");
  });

  it("sends production bookmarks to the public docs domain by default", async () => {
    vi.stubEnv("NEXT_PUBLIC_DOCS_URL", undefined);
    vi.resetModules();
    const { default: nextConfig } = await import("../../next.config");
    const routes = await nextConfig.redirects?.();
    expect(routes?.find((route) => route.source === "/docs")?.destination).toBe("https://docs.masayume.app");
  });

  it("preserves nested guides and their query on a configured docs origin", async () => {
    const response = await responseFor("/docs/start/wallet?from=bookmark", " https://docs.example.com/ ");
    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe("https://docs.example.com/start/wallet?from=bookmark");
  });

  it("does not claim unrelated missing application paths", async () => {
    const response = await responseFor("/missing-application-page");
    expect(getRedirectUrl(response)).toBeNull();
  });
});
