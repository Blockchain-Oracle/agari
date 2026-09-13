"use client";

import { MARKET_PARAM } from "@masayume/core/urls";
import type { ReelItem } from "@/features/takes";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Where the reel is, kept in the address bar.
 *
 * The reference's UP/DOWN are `<Link href="/markets">` (kept — the user's call), so leaving the reel
 * to bet and coming back is a real navigation, and a snap container's offset is not something the
 * browser restores. So the card on screen writes `?m=<marketId>` with `replaceState` — no history
 * entry, no re-render — and on mount the reel scrolls once to the card that parameter names, the
 * moment that card exists. `reelsDeepLink` in core builds the same URL for anything that wants to
 * point at a card.
 *
 * ↑/↓ and PageUp/PageDown move one card, as a thumb would — additive; neither reference had a
 * keyboard path — and stay out of the composer's textarea.
 */
export function useReelPosition(scrollRef: RefObject<HTMLElement | null>, reel: readonly ReelItem[], activeIndex: number): void {
  const restored = useRef(false);
  // False between a restore that scrolled and the observer's first report, so the write below
  // does not stamp the first card's id over the one that was asked for.
  const armed = useRef(false);

  useEffect(() => {
    if (restored.current || reel.length === 0) return;
    restored.current = true;
    const wanted = new URLSearchParams(window.location.search).get(MARKET_PARAM);
    const index = wanted ? reel.findIndex((item) => item.kind === "market" && item.market.marketId === wanted) : -1;
    const card = index > 0 ? (scrollRef.current?.children[index] as HTMLElement | undefined) : undefined;
    if (card) {
      card.scrollIntoView({ block: "start" });
      armed.current = false;
    } else {
      armed.current = true;
    }
  }, [reel, scrollRef]);

  useEffect(() => {
    if (!armed.current) {
      if (activeIndex === 0) return;
      armed.current = true;
    }
    const item = reel[activeIndex];
    if (!item || item.kind !== "market") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(MARKET_PARAM) === item.market.marketId) return;
    url.searchParams.set(MARKET_PARAM, item.market.marketId);
    window.history.replaceState(window.history.state, "", url);
  }, [reel, activeIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = scrollRef.current;
      if (!root || event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) return;
      const step = event.key === "ArrowDown" || event.key === "PageDown" ? 1 : event.key === "ArrowUp" || event.key === "PageUp" ? -1 : 0;
      if (step === 0) return;
      event.preventDefault();
      root.scrollBy({ top: step * root.clientHeight, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollRef]);
}
