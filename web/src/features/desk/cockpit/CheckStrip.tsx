"use client";

import { ArrowRight, Check, Lock, LockOpen } from "lucide-react";
import Link from "next/link";
import { CountdownRing } from "@/components/data";
import { DESK } from "../copy";
import { ago, clock, nextTopOfHour, span } from "../format";
import type { DeskView } from "../view";
import { COCKPIT } from "./copy-cockpit";

/** A checklist mark after 21st's Onboarding Checklist (#30552): an empty ring, filled with a tick once done. */
function Tick({ on }: { on: boolean }) {
  return (
    <span className="cp-tick" data-on={on ? "" : undefined} aria-hidden>
      {on && <Check strokeWidth={3} />}
    </span>
  );
}

/**
 * Item 3 as a card beside the plate (S22): the hour's ring, the next and last check, the mode's note, and for a
 * practice desk the two-item checklist before Go live: six practice checks (six segments fill one per check) and the record read.
 */
export function CheckStrip({ view, zone, nowSec, onGoLive }: { view: DeskView; zone: string | null; nowSec: number; onGoLive: (() => void) | null }) {
  const C = DESK.page.nextCheck;
  const atSec = nextTopOfHour(nowSec);
  const fraction = Math.max(0, Math.min(1, (atSec - nowSec) / 3_600));
  const active = view.state === "active" || view.state === "practice";
  const { practice } = view;
  const checksDone = practice.done >= practice.needed;
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
      <p className="type-caption text-ink-muted">{C.note[view.mode]} {C.also}</p>
      {!view.isLive && view.exists && (
        <div className="cp-practice">
          <div className="cp-practice-head">
            <span className="cp-stat-label">{C.checklist}</span>
            <span className="cp-practice-count">{(checksDone ? 1 : 0) + (practice.opened ? 1 : 0)}/2</span>
          </div>
          <ul className="cp-list">
            <li className="cp-list-item" data-done={checksDone ? "" : undefined}>
              <Tick on={checksDone} />
              <div className="cp-list-text">
                <span>{C.checksDone(practice.done, practice.needed)}</span>
                <div className="cp-segments" aria-hidden>
                  {Array.from({ length: practice.needed }, (_, i) => (
                    <span key={i} className="cp-segment" data-on={i < practice.done ? "" : undefined} style={{ transitionDelay: `${i * 60}ms` }} />
                  ))}
                </div>
              </div>
            </li>
            <li className="cp-list-item" data-done={practice.opened ? "" : undefined}>
              <Tick on={practice.opened} />
              <div className="cp-list-text">
                <span>{practice.opened ? C.recordRead : C.readRecord}</span>
              </div>
              {!practice.opened && view.isOwner && (
                <Link href={`/desk/${view.wire.desk?.id ?? ""}/record`} className="cp-list-open">
                  {C.open}
                  <ArrowRight aria-hidden />
                </Link>
              )}
            </li>
          </ul>
          {view.isOwner && (
            <button type="button" className="cp-golive" data-ready={practice.ready ? "" : undefined} disabled={!practice.ready || !onGoLive} onClick={onGoLive ?? undefined}>
              {practice.ready ? <LockOpen /> : <Lock />}
              {C.goLive}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
