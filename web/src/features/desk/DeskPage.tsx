"use client";

import { Activity, LayoutDashboard, Layers, ScrollText } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TabsPanel, UnderlineTabs, type TabItem } from "@/components/ui/desk-kit";
import { CheckStrip } from "./cockpit/CheckStrip";
import { CockpitHeader } from "./cockpit/CockpitHeader";
import { COCKPIT, COCKPIT_TABS, type CockpitTab } from "./cockpit/copy-cockpit";
import { OverviewTab } from "./cockpit/OverviewTab";
import { ValueHero } from "./cockpit/ValueHero";
import { DESK_ADVICE } from "./copy";
import { GO_LIVE } from "./copy-controls";
import { DeskControls, type ControlKind } from "./DeskControls";
import { GoLive } from "./GoLive";
import { HoldingsTab } from "./HoldingsPanel";
import { RulesTab } from "./MandatePanel";
import { ActivityTab } from "./RecordPanel";
import type { DeskActions } from "./useDeskWrites";
import type { DeskView } from "./view";
import "./desk.css";
import "./cockpit/cockpit.css";

export interface DeskPageProps {
  view: DeskView;
  /** Null for a visitor and for fixtures without a wallet: every control is read-only. */
  actions: DeskActions | null;
  zone: string | null;
  nowSec: number;
  initialControl?: ControlKind | null;
}

const isTab = (v: string | null): v is CockpitTab => v !== null && (COCKPIT_TABS as readonly string[]).includes(v);

/** The tab lives in `?tab=`, read after mount so the server and the first client render agree, written on change. */
function useUrlTab(): [CockpitTab, (t: CockpitTab) => void] {
  const [tab, setTab] = useState<CockpitTab>("overview");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (isTab(t)) setTab(t);
  }, []);
  const choose = (t: CockpitTab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(window.history.state, "", url);
  };
  return [tab, choose];
}

function Rise({ i, children }: { i: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.07, ease: [0.22, 1, 0.36, 1] }} className="cp-rise">
      {children}
    </motion.div>
  );
}

/**
 * The desk page as a cockpit (S22, D-127; plan §5.7's items, regrouped): the head with the owner's toolbar, the plate
 * as a value chart beside the next check, then Overview · Holdings · Activity · Rules. A shared desk is the same page
 * read-only with "Someone else's desk" at the top.
 */
export function DeskPage({ view, actions, zone, nowSec, initialControl = null }: DeskPageProps) {
  const [tab, setTab] = useUrlTab();
  const [control, setControl] = useState<ControlKind | null>(initialControl);
  const [goLive, setGoLive] = useState(false);
  const base = `/desk/${view.wire.desk?.id ?? ""}`;
  const owner = view.isOwner && actions !== null;
  const needs = view.approvals.open.length;
  const tabs: TabItem<CockpitTab>[] = [
    { value: "overview", label: COCKPIT.tabs.overview, icon: <LayoutDashboard />, ...(needs > 0 ? { count: needs } : {}) },
    { value: "holdings", label: COCKPIT.tabs.holdings, icon: <Layers />, ...(view.holdings.length > 0 ? { count: view.holdings.length } : {}) },
    { value: "activity", label: COCKPIT.tabs.activity, icon: <Activity />, ...(view.wire.recent.length > 0 ? { count: view.wire.recent.length } : {}) },
    { value: "rules", label: COCKPIT.tabs.rules, icon: <ScrollText /> },
  ];
  return (
    <div className="cp-page container">
      <Rise i={0}>
        <CockpitHeader view={view} actions={<DeskControls view={view} actions={owner ? actions : null} zone={zone} nowSec={nowSec} open={control} setOpen={setControl} />} />
      </Rise>
      <Rise i={1}>
        <div className="cp-top">
          <ValueHero view={view} nowSec={nowSec} />
          <CheckStrip view={view} zone={zone} nowSec={nowSec} onGoLive={owner ? () => setGoLive(true) : null} />
        </div>
      </Rise>
      <Rise i={2}>
        <UnderlineTabs value={tab} onChange={setTab} items={tabs} label={COCKPIT.tabsAria}>
          <TabsPanel value="overview">
            <OverviewTab view={view} actions={owner ? actions : null} base={base} zone={zone} nowSec={nowSec} />
          </TabsPanel>
          <TabsPanel value="holdings">
            <HoldingsTab view={view} />
          </TabsPanel>
          <TabsPanel value="activity">
            <ActivityTab records={view.wire.recent} base={base} nowSec={nowSec} zone={zone} />
          </TabsPanel>
          <TabsPanel value="rules">
            <RulesTab view={view} />
          </TabsPanel>
        </UnderlineTabs>
      </Rise>
      <p className="type-caption text-ink-muted">{DESK_ADVICE}</p>
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
