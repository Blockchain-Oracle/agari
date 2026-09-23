"use client";

import { Lock, LockOpen } from "lucide-react";
import { CountdownRing } from "@/components/data";
import { DESK } from "../copy";
import { ago, clock, nextTopOfHour, span } from "../format";
import type { DeskView } from "../view";
import { COCKPIT } from "./copy-cockpit";

/**
 * Item 3 as a card beside the plate (S22): the hour's ring, the next and last check, the mode's note, and for a
 * practice desk six segments that fill one per check with Go live locked until they are done and the record opened.
 */
export function CheckStrip({ view, zone, nowSec, onGoLive }: { view: DeskView; zone: string | null; nowSec: number; onGoLive: (() => void) | null }) {
  const C = DESK.page.nextCheck;
  const atSec = nextTopOfHour(nowSec);
  const fraction = Math.max(0, Math.min(1, (atSec - nowSec) / 3_600));
  const active = view.state === "active" || view.state === "practice";
  const { practice } = view;
  return (
    <section className="cp-card cp-check" aria-label={C.title}>
      <span className="dk-panel-title">{C.title}</span>
      <div className="cp-check-main">
        <CountdownRing fraction={fraction} className="cp-ring">
          <span className="cp-ring-text">{span(atSec - nowSec)}</span>
        </CountdownRing>
        <div className="cp-check-text">
          <p className={active ? "cp-check-lead" : "cp-check-lead dk-warn"}>{active ? C.lead(clock(atSec, zone), span(atSec - nowSec)) : view.stateText}</p>
          <p className="type-caption text-ink-secondary">{view.nextCheck.lastAtSec === null ? C.noCheck : C.lastCheck(ago(view.nextCheck.lastAtSec, nowSec))}</p>
        </div>
      </div>
      <p className="type-caption text-ink-muted">{DESK.modeNote[view.mode]} {C.also}</p>
      {!view.isLive && view.exists && (
        <div className="cp-practice">
          <div className="cp-practice-head">
            <span className="cp-stat-label">{COCKPIT.check.practice}</span>
            <span className="cp-practice-count">{Math.min(practice.done, practice.needed)}/{practice.needed}</span>
          </div>
          <div className="cp-segments" aria-hidden>
            {Array.from({ length: practice.needed }, (_, i) => (
              <span key={i} className="cp-segment" data-on={i < practice.done ? "" : undefined} style={{ transitionDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <p className="type-caption text-ink-secondary">
            {C.progress(practice.done, practice.needed)} · {practice.opened ? C.opened : C.notOpened}
            {practice.ready ? ` · ${C.goLiveReady}` : ""}
          </p>
          {view.isOwner && (
            <button type="button" className="cp-golive" data-ready={practice.ready ? "" : undefined} disabled={!practice.ready || !onGoLive} onClick={onGoLive ?? undefined} title={practice.ready ? undefined : C.goLiveLocked(practice.needed)}>
              {practice.ready ? <LockOpen /> : <Lock />}
              {C.goLive}
            </button>
          )}
          {view.isOwner && !practice.ready && <p className="type-caption text-ink-muted">{C.goLiveLocked(practice.needed)}</p>}
        </div>
      )}
    </section>
  );
}
