import { router, useGlobalSearchParams, usePathname as useExpoPathname } from "expo-router";
import { useMemo } from "react";

/**
 * Stands in for `next/navigation` in the web code the app reuses: the pathname and query are the app route's own
 * (`/markets/<id>?dir=up`), navigation is Expo Router's.
 */
export function usePathname(): string {
  return useExpoPathname();
}

export function useSearchParams(): URLSearchParams {
  const params = useGlobalSearchParams();
  return useMemo(() => {
    const out = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") out.set(key, value);
      else if (Array.isArray(value)) value.forEach((v) => out.append(key, v));
    }
    return out;
  }, [params]);
}

export function useRouter() {
  return {
    push: (href: string) => router.push(href as never),
    replace: (href: string) => router.replace(href as never),
    back: () => router.back(),
    forward: () => undefined,
    refresh: () => undefined,
    prefetch: () => undefined,
  };
}

export function redirect(href: string): never {
  router.replace(href as never);
  throw new Error(`redirected to ${href}`);
}

export function notFound(): never {
  throw new Error("not found");
}
