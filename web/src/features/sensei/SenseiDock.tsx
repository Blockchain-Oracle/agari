"use client";

import { countdown } from "@masayume/core/lifecycle";
import type { LaneSet } from "@masayume/core/types";
import { useEffect, useState, type CSSProperties } from "react";
import MasayumeMark from "@/components/shell/MasayumeMark";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { SENSEI_TEASERS, SENSEI_UI } from "./copy";
import { SenseiDrawer } from "./SenseiDrawer";
import { useSenseiChat } from "./useSenseiChat";
import { useSenseiSnapshot } from "./useSenseiSnapshot";

/** The ring's geometry, from the reference's `R = 30` on a 72-unit viewBox. */
const R = 30;
const TAU = 2 * Math.PI * R;

/** Teaser cadence, from reference L159–176: three pops, then it rests. */
const TEASER_FIRST_MS = 3_500;
const TEASER_HOLD_MS = 4_800;
const TEASER_GAP_MS = 4_500;
const TEASER_POPS = 3;

interface SenseiDockProps {
  laneSet: LaneSet | null;
  nowMs: number;
}

/** Anything on the site can ask for Sensei by firing this; the nav does not need a route. */
export const SENSEI_OPEN_EVENT = "sensei:open";

function useTeaser(open: boolean): number {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    if (open || reduced) {
      setIndex(-1);
      return;
    }
    let alive = true;
    let pops = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = (delay: number) => {
      timers.push(
        setTimeout(() => {
          if (!alive) return;
          setIndex(pops % SENSEI_TEASERS.length);
          timers.push(
            setTimeout(() => {
              if (!alive) return;
              setIndex(-1);
              pops += 1;
              if (pops < TEASER_POPS) cycle(TEASER_GAP_MS);
            }, TEASER_HOLD_MS),
          );
        }, delay),
      );
    };
    cycle(TEASER_FIRST_MS);
    return () => {
      alive = false;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [open, reduced]);

  return index;
}

/**
 * The Sensei dock — ported from `reference/yosuku/components/SenseiDock.tsx`.
 *
 * It keeps the countdown's job (a draining ring and the time to the next close,
 * urgent under the wire) and makes the whole orb Sensei: tap it and the drawer
 * springs in with the market-aware assistant.
 *
 * The ring, the teaser and the drawer's meter all work with no API key at all —
 * they read the same market stream `/markets` is already running. Only the reply
 * needs the brain, and an unconfigured brain says so in the thread. That is what
 * lets the whole surface ship before the credential exists.
 */
export function SenseiDock({ laneSet, nowMs }: SenseiDockProps) {
  const [open, setOpen] = useState(false);
  const reading = useSenseiSnapshot(laneSet, nowMs);
  const chat = useSenseiChat(reading.snapshot);
  const teaserIndex = useTeaser(open);

  // The nav points at `?sensei=1`. A client-side nav to the page you are already on
  // does not remount this, so the query alone would silently fail to open it — the
  // reference's own fix, and its reason, kept.
  useEffect(() => {
    const onAsk = () => setOpen(true);
    window.addEventListener(SENSEI_OPEN_EVENT, onAsk);
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (anchor instanceof HTMLAnchorElement && anchor.getAttribute("href")?.includes("sensei=1")) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("click", onClick);
    if (new URLSearchParams(window.location.search).get("sensei") === "1") {
      setOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("sensei");
      window.history.replaceState({}, "", url.toString());
    }
    return () => {
      window.removeEventListener(SENSEI_OPEN_EVENT, onAsk);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const nearest = reading.nearest;
  // Urgency and the ring's fraction come from `countdown`, the same venue-aware rule
  // the hero and the reel use — not the reference's flat 60 s and fixed cadence table.
  const clock = nearest && nowMs > 0 ? countdown(nowMs, nearest.expirySec, nearest.intervalSec) : null;
  const secsLeft = clock?.remainingSec ?? 0;
  const urgent = clock?.urgent ?? false;
  const fraction = nearest && clock ? Math.max(0, Math.min(1, secsLeft / Math.max(1, nearest.intervalSec))) : 0;

  const markets = reading.snapshot === null ? [] : (laneSet?.lanes.flatMap((lane) => lane.markets) ?? []);
  const nearestMarkets = markets
    .filter((market) => market.expirySec * 1000 > nowMs)
    .sort((a, b) => a.expirySec - b.expirySec)
    .slice(0, reading.snapshot?.markets.length ?? 0);

  return (
    <>
      <div className="sensei-dock-wrap">
        {teaserIndex >= 0 && !open && (
          <button
            key={teaserIndex}
            type="button"
            className="sensei-teaser"
            onClick={() => setOpen(true)}
            aria-label={SENSEI_UI.ask(SENSEI_TEASERS[teaserIndex]!)}
            data-cursor="hover"
          >
            {SENSEI_TEASERS[teaserIndex]}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={SENSEI_UI.open}
          aria-expanded={open}
          data-cursor="hover"
          className={cn("sensei-dock", urgent && "urgent", open && "is-open")}
        >
          <span className="sensei-dock-copy">
            <span className="sd-name">
              {SENSEI_UI.name} <b>{SENSEI_UI.nameEmphasis}</b>
            </span>
          </span>
          <span className="sensei-dock-avatar">
            <svg viewBox="0 0 72 72" className="sensei-dock-ring" aria-hidden>
              <circle cx="36" cy="36" r={R} className="sd-track" />
              <circle cx="36" cy="36" r={R} className="sd-fill" style={{ strokeDasharray: TAU, strokeDashoffset: TAU * (1 - fraction) } as CSSProperties} />
            </svg>
            <MasayumeMark className="sd-avatar-glyph" />
            <span className="sensei-dock-pulse" aria-hidden />
          </span>
        </button>
      </div>

      <SenseiDrawer
        open={open}
        onClose={() => setOpen(false)}
        chat={chat}
        reading={reading}
        markets={nearestMarkets}
        nowMs={nowMs}
        secsLeft={secsLeft}
        urgent={urgent}
      />
    </>
  );
}
