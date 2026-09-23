"use client";

import { nameOf, presetById } from "@agari/core/desk";
import { LogoStack, StatusDot, type DotTone } from "@/components/ui/desk-kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { DESK } from "../copy";
import type { DeskView } from "../view";
import { COCKPIT } from "./copy-cockpit";
import type { ReactNode } from "react";

/** The dot's tone: live desks breathe, practice is the accent, a pause or a loss stop warns, a closed desk is still. */
export function stateTone(view: DeskView): DotTone {
  if (view.state === "stopped_by_loss_limit") return "stopped";
  if (view.state === "paused_by_owner" || view.state === "needs_attention") return "warn";
  if (view.state === "closed") return "quiet";
  return view.isLive ? "live" : "practice";
}

/** What the desk holds by name: the preset's basket, or the owner's own mix. */
export function basketOf(view: DeskView): { name: string; basket: string | null; members: string[] } {
  const m = view.mandate;
  const preset = m?.preset ? presetById(m.preset) : undefined;
  const members = m?.targets.tokens.map((t) => t.symbol) ?? view.holdings.map((h) => h.symbol);
  return { name: preset?.name ?? COCKPIT.ownMix, basket: preset?.basket ?? null, members };
}

/**
 * The cockpit's head (S22): the basket's cluster mark, "AI Labs desk" (a visitor reads "A desk"), the state dot with
 * the mode, the members as logos, and the owner's toolbar on the right.
 */
export function CockpitHeader({ view, actions }: { view: DeskView; actions: ReactNode }) {
  const b = basketOf(view);
  const title = view.isOwner ? COCKPIT.deskOf(b.name) : DESK.visitorTitle;
  const showState = view.state !== "active" && view.state !== "practice";
  return (
    <header className="cp-head">
      <div className="cp-head-id">
        <span className="cp-head-mark" aria-hidden>
          {b.basket ? <AssetDisc asset={b.basket} className="cp-head-disc" /> : <LogoStack symbols={b.members} size="lg" max={3} />}
        </span>
        <div className="cp-head-text">
          <span className="dk-eyebrow" data-live={view.isLive ? "" : undefined}>{view.eyebrow}</span>
          <div className="cp-head-title">
            <h1 className="dk-title">{title}</h1>
            <span className="dk-title-jp" lang="ja">{DESK.titleJp}</span>
          </div>
          <div className="cp-head-meta">
            <StatusDot tone={stateTone(view)}>{showState ? view.stateText : DESK.modes[view.mode]}</StatusDot>
            {showState && <span className="cp-head-mode">{DESK.modes[view.mode]}</span>}
            <span className="cp-head-members">
              <LogoStack symbols={b.members} size="sm" max={4} names={b.members.map((s) => nameOf(s as never))} />
              <span>{!view.isOwner && b.name !== COCKPIT.ownMix ? `${b.name} · ` : ""}{b.members.map((s) => nameOf(s as never)).join(", ")}</span>
            </span>
          </div>
        </div>
      </div>
      {actions}
      {!view.isOwner && <p className="cp-visitor type-caption text-ink-muted">{DESK.visitor}</p>}
    </header>
  );
}
