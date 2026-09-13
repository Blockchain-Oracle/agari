"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether the reader has asked for less motion, kept in sync with the setting.
 *
 * Starts `false` so the server and the first client render agree, then settles
 * after mount. Subscribed rather than read once, because the setting can change
 * while the page is open — the reference reads its equivalent at module scope,
 * which both breaks SSR and freezes the answer for the session.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return;
    setReduced(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
