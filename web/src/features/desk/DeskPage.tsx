"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DESK, DESK_ADVICE } from "./copy";
import { GO_LIVE } from "./copy-controls";
import { DeskControls, type ControlKind } from "./DeskControls";
import { NeedsYou, NextCheck, Panel, Plate } from "./DeskPanels";
import { GoLive } from "./GoLive";
import { Cash, Holdings, LimitsInUse } from "./HoldingsPanel";
import { MandatePanel } from "./MandatePanel";
import { RecordPanel } from "./RecordPanel";
import type { DeskActions } from "./useDeskWrites";
import type { DeskView } from "./view";
import "./desk.css";

export interface DeskPageProps {
  view: DeskView;
  /** Null for a visitor and for fixtures without a wallet: every control is read-only. */
  actions: DeskActions | null;
  zone: string | null;
  nowSec: number;
  initialControl?: ControlKind | null;
}

/**
 * The desk page (plan §5.7), top to bottom: Needs you, the plate with Timing, Next check, Holdings, Cash, Limits in
 * use, the record, the mandate, Controls. Two columns above 900px with the record beside; tabs on a phone. A shared
 * desk shows the same page read-only with "Someone else's desk" at the top.
 */
export function DeskPage({ view, actions, zone, nowSec, initialControl = null }: DeskPageProps) {
  const [tab, setTab] = useState<"desk" | "record">("desk");
  const [control, setControl] = useState<ControlKind | null>(initialControl);
  const [goLive, setGoLive] = useState(false);
  const base = `/desk/${view.wire.desk?.id ?? ""}`;
  const owner = view.isOwner && actions !== null;
  return (
    <div className="dk-page container">
      <header className="dk-hero">
        <span className="dk-eyebrow" data-live={view.isLive ? "" : undefined}>{view.eyebrow}</span>
        <div className="dk-title-row">
          <h1 className="dk-title">{view.isOwner ? DESK.title : DESK.visitorTitle}</h1>
          <span className="dk-title-jp" lang="ja">{DESK.titleJp}</span>
          <span className="dk-chip" data-mode={view.mode}>{DESK.modes[view.mode]}</span>
          {view.state !== "active" && view.state !== "practice" && <span className="dk-chip" data-state={view.state}>{view.stateText}</span>}
        </div>
        {!view.isOwner && <p className="type-caption text-ink-muted">{DESK.visitor}</p>}
      </header>
      <div className="dk-tabs" role="tablist">
        {(["desk", "record"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="dk-tab" onClick={() => setTab(t)}>{DESK.tabs[t]}</button>
        ))}
      </div>
      <div className="dk-grid" data-tab={tab}>
        <div data-panel="desk">
          <NeedsYou view={view} actions={owner ? actions : null} zone={zone} nowSec={nowSec} />
          <Plate view={view} nowSec={nowSec} />
          <NextCheck view={view} zone={zone} nowSec={nowSec} onGoLive={owner ? () => setGoLive(true) : null} />
          <Holdings view={view} />
          <Cash view={view} />
          <LimitsInUse view={view} />
          <MandatePanel view={view} />
          <DeskControls view={view} actions={owner ? actions : null} zone={zone} nowSec={nowSec} open={control} setOpen={setControl} />
        </div>
        <div data-panel="record">
          <RecordPanel records={view.wire.recent} base={base} nowSec={nowSec} zone={zone} />
          <Panel title={DESK.promise.title}>
            <ol className="dk-promise">
              {DESK.promise.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ol>
            <p className="type-caption text-ink-muted">{DESK.promise.worstCase}</p>
          </Panel>
          <p className="type-caption text-ink-muted">{DESK_ADVICE}</p>
        </div>
      </div>
      {owner && actions && (
        <Sheet open={goLive} onOpenChange={setGoLive}>
          <SheetContent side="bottom" className="dk-sheet">
            <SheetTitle className="sr-only">{GO_LIVE.title}</SheetTitle>
            {goLive && <GoLive view={view} actions={actions} liveMode="ask_first" zone={zone} nowSec={nowSec} />}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
