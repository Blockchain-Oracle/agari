"use client";

import type { ReactNode } from "react";
import { shortHex } from "@masayume/core/units";
import { TRADE_FROM_X } from "./copy";

export type StepState = "idle" | "active" | "done";

/** A step on the focus-follows-step spine (reference `Step`): the segment below fills once the flow has moved past it. */
export function Step({ n, title, state, spine, isLast, children }: { n: string; title: string; state: StepState; spine: { from: number; cur: number }; isLast?: boolean; children: ReactNode }) {
  const done = state === "done";
  const active = state === "active";
  const filled = spine.cur > spine.from;
  return (
    <li className={`xt-step${isLast ? " xt-step--last" : ""}${state === "idle" ? " xt-step--idle" : ""}`}>
      <div className="xt-step-rail">
        <div className={`xt-step-node${done ? " xt-step-node--done" : active ? " xt-step-node--active xt-node-active" : ""}`}>{done ? <Tick /> : n}</div>
        {!isLast && (
          <div className="xt-spine">
            <div className="xt-spine-fill" style={{ transform: `scaleY(${filled ? 1 : 0})` }} />
          </div>
        )}
      </div>
      <div className={`xt-step-card${done ? " xt-step-card--done" : active ? " xt-step-card--active" : ""}`}>
        <div className="xt-step-title">{title}</div>
        {children}
      </div>
    </li>
  );
}

export function Dot({ v }: { v?: boolean }) {
  return <span className={`xt-dot${v ? " xt-dot--v" : ""}`} />;
}

export function Tick() {
  return (
    <svg className="xt-check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="var(--xt-m)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The connected wallet as a chip: the orb's gradient is seeded by the address itself (reference `IdentityChip`). */
export function IdentityChip({ addr }: { addr: string }) {
  const g = addr.slice(2, 8);
  return (
    <div className="xt-chip">
      <span className="xt-chip-orb" style={{ background: `conic-gradient(from 0deg, #${g}, var(--xt-v), var(--xt-m), #${g})` }} />
      <span className="xt-chip-addr">{shortHex(addr)}</span>
      <span className="xt-chip-state">
        <Dot /> {TRADE_FROM_X.connected}
      </span>
    </div>
  );
}

export function ProofLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="xt-proof">
      <span className="xt-proof-arrow">↗</span> {children}
    </a>
  );
}
