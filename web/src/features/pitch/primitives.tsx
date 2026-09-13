"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The folio's typographic furniture — ported from `reference/yosuku/app/pitch/page.tsx`
 * L30–273. The reference writes every value inline (`fontSize: 22`, `PAPER`, `HAIR`);
 * `design-literals` bans hex and px in TSX, so each becomes a class in `pitch.css`
 * with the source value named above the rule.
 *
 * Motion: framer-motion is not installed. The reference's `rise` variant with a
 * staggered parent becomes the `pitch-rise` keyframe, delayed per child by `--i`.
 */

type Tone = "ink" | "live" | "verm";

/** One risen element; `i` is its place in the parent's stagger order (reference: staggerChildren 0.08). */
export function Rise({ i = 0, className, children, style }: { i?: number; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={cn("pitch-rise", className)} style={{ ...style, "--i": i } as CSSProperties}>
      {children}
    </div>
  );
}

/* ── the "stub": ticket-perforation emphasis (reference L31–45) ── */
export function Emph({ children, delay = 0.55 }: { children: ReactNode; delay?: number }) {
  return (
    <span className="pitch-emph" style={{ "--emph-delay": `${delay}s` } as CSSProperties}>
      <span className="pitch-emph-text">{children}</span>
      <span aria-hidden className="pitch-emph-line" />
      <span aria-hidden className="pitch-emph-dot" />
    </span>
  );
}

/* font-mono uppercase, letterSpacing 0.16em (reference L47) */
export function Mono({ children, className, tone }: { children: ReactNode; className?: string; tone?: Tone | "mute" | "faint" }) {
  return (
    <span className={cn("pitch-mono", className)} data-tone={tone}>
      {children}
    </span>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <Rise className="pitch-kicker">
      <span className="pitch-kicker-square" aria-hidden />
      {children}
    </Rise>
  );
}

export function Pill({ children, tone = "ink", icon }: { children: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <span className="pitch-pill" data-tone={tone}>
      {icon ? <span className="pitch-pill-icon">{icon}</span> : <span className="pitch-pill-dot" aria-hidden />}
      {children}
    </span>
  );
}

export type SpecRow = readonly [string, ReactNode, boolean?];

/** The receipt/ledger stub — a titled rule with a vermilion eyelet, then dotted-leader rows (reference L201–222). */
export function SpecPanel({ title, badge, badgeTone = "live", rows, wide = false, i = 1 }: { title: string; badge?: string; badgeTone?: "live" | "verm"; rows: readonly SpecRow[]; wide?: boolean; i?: number }) {
  return (
    <Rise i={i} className={cn("pitch-spec", wide && "wide")}>
      <div className="pitch-spec-inner">
        <div className="pitch-spec-head">
          <Mono className="pitch-spec-title">{title}</Mono>
          {badge && (
            <Mono className="pitch-spec-badge" tone={badgeTone}>
              {badge}
            </Mono>
          )}
        </div>
        <div className="pitch-rule">
          <span className="pitch-rule-eyelet" />
        </div>
        <div className="pitch-spec-rows">
          {rows.map(([k, v, hl], index) => (
            <div key={index} className="pitch-spec-row">
              <Mono className="pitch-spec-key">{k}</Mono>
              <span aria-hidden className="pitch-leader" />
              <span className="pitch-spec-val" data-hl={hl ? "true" : undefined}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Rise>
  );
}

/** Cover hero facts: bold Sora values (reference L225–245). */
export function Glance({ title, badge, rows, i = 1 }: { title: string; badge: string; rows: readonly SpecRow[]; i?: number }) {
  return (
    <Rise i={i} className="pitch-glance">
      <div className="pitch-glance-head">
        <Mono className="pitch-glance-title">{title}</Mono>
        <Mono className="pitch-glance-badge" tone="live">
          {badge}
        </Mono>
      </div>
      <div className="pitch-rule">
        <span className="pitch-rule-eyelet" />
      </div>
      {rows.map(([k, v, hl], index) => (
        <div key={index} className="pitch-glance-row">
          <Mono className="pitch-glance-key" tone="faint">
            {k}
          </Mono>
          {typeof v === "string" ? (
            <span className="pitch-glance-val" data-hl={hl ? "true" : undefined}>
              {v}
            </span>
          ) : (
            <span className="pitch-glance-el">{v}</span>
          )}
        </div>
      ))}
    </Rise>
  );
}

export function StatCard({ value, label, source, hl, i = 1 }: { value: ReactNode; label: string; source?: string; hl?: boolean; i?: number }) {
  return (
    <Rise i={i} className="pitch-stat">
      <div className="pitch-stat-value" data-hl={hl ? "true" : undefined}>
        {value}
      </div>
      <div aria-hidden className="pitch-stat-dots" />
      <div className="pitch-stat-label">{label}</div>
      {source && <div className="pitch-stat-source">{source}</div>}
    </Rise>
  );
}

/** now/next/then phase cards (reference L259–267). */
export function PhaseCard({ tag, title, body, tone = "ink", i = 1 }: { tag: string; title: string; body: string; tone?: "ink" | "live"; i?: number }) {
  return (
    <Rise i={i} className="pitch-phase">
      <div className="pitch-phase-card" data-tone={tone}>
        <Mono className="pitch-phase-tag" tone={tone === "live" ? "live" : "verm"}>
          {tag}
        </Mono>
        <div className="pitch-phase-title">{title}</div>
        <div className="pitch-phase-body">{body}</div>
      </div>
    </Rise>
  );
}

/** The reference's rAF count-up (L269–273); with reduced motion the final figure lands at once. */
export function CountUp({ to, decimals = 0, dur = 1.4, prefix = "" }: { to: number; decimals?: number; dur?: number; prefix?: string }) {
  const reduced = usePrefersReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced) {
      setV(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / (dur * 1000));
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, dur, reduced]);
  return (
    <>
      {prefix}
      {v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </>
  );
}

/** Registration tick at one corner of the folio frame (reference L636–644). */
export function Tick({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  return (
    <span className="pitch-tick" data-pos={pos} aria-hidden>
      <span className="pitch-tick-v" />
      <span className="pitch-tick-h" />
    </span>
  );
}

/** A small label that says a visual is a mock, a concept, or not live — never product state. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="pitch-tag">{children}</span>;
}
