"use client";

import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/states";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useWalletSession } from "@/lib/wallet-session";
import { useViewerZone } from "@/lib/when";
import { DESK, DESK_ADVICE } from "./copy";
import { RECORD } from "./copy-record";
import type { RecordSummaryWire } from "./protocol";
import { foldQuietRuns } from "./record-rows";
import { Rows } from "./RecordPanel";
import { useDeskRecords, useDeskView, useInvalidateDesk } from "./useDesk";
import "./desk.css";

const L = RECORD.list;

export interface RecordListViewProps {
  records: readonly RecordSummaryWire[];
  base: string;
  nowSec: number;
  zone: string | null;
  isOwner: boolean;
  isLive: boolean;
  /** Present when an older page exists. */
  older: (() => void) | null;
}

/**
 * The whole record (plan §5.7 item 7, §5.8): every check the desk ever made, newest first, the quiet ones folded
 * into one openable line each. Presentational; `RecordScreen` below reads the hooks.
 */
export function RecordListView({ records, base, nowSec, zone, isOwner, isLive, older }: RecordListViewProps) {
  return (
    <div className="dk-page container">
      <header className="dk-hero">
        <span className="dk-eyebrow" data-live={isLive ? "" : undefined}>{isOwner ? (isLive ? DESK.eyebrow.live : DESK.eyebrow.practice) : isLive ? DESK.eyebrow.visitorLive : DESK.eyebrow.visitorPractice}</span>
        <Link href={base} className="dk-link type-caption">{L.back}</Link>
        <h1 className="dk-title">{L.title}</h1>
        <p className="type-caption text-ink-secondary">{L.intro}</p>
        {!isOwner && <p className="type-caption text-ink-muted">{DESK.visitor}</p>}
      </header>
      <section className="dk-panel" aria-label={L.title}>
        {records.length === 0 ? <p className="type-body text-ink-secondary">{L.empty}</p> : <Rows rows={foldQuietRuns(records)} base={base} nowSec={nowSec} zone={zone} />}
        {older && (
          <button type="button" className="dk-control self-start" onClick={older}>{L.older}</button>
        )}
      </section>
      <p className="type-caption text-ink-muted">{DESK_ADVICE}</p>
    </div>
  );
}

/** Opening the whole record is one of Go live's two conditions: the owner's first visit tells the index so. */
function useMarkOpened(id: string, owner: Address | null, needed: boolean) {
  const invalidate = useInvalidateDesk();
  useEffect(() => {
    if (!needed || !owner) return;
    void fetch(`/api/desk/${encodeURIComponent(id)}/opened`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ owner }) }).then(() => invalidate());
  }, [id, owner, needed, invalidate]);
}

export function RecordScreen({ id }: { id: string }) {
  const { address } = useWalletSession();
  const zone = useViewerZone();
  const nowMs = useChainNowMs();
  const nowSec = Math.floor((nowMs || Date.now()) / 1000);
  const view = useDeskView(id, address);
  const [pages, setPages] = useState<RecordSummaryWire[][]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const page = useDeskRecords(id, address, before);
  const desk = view && isOk(view) ? view.value.desk : null;
  const isOwner = view && isOk(view) ? view.value.viewer === "owner" : false;
  useMarkOpened(id, address, isOwner && desk !== null && desk.recordOpenedAtSec === null);
  useEffect(() => {
    if (page && isOk(page)) setPages((p) => (before === null ? [page.value.records] : [...p.slice(0, -1), page.value.records]));
  }, [page, before]);

  if (view === null || page === null) return <LoadingState shape="plate" className="container py-8" />;
  if (!isOk(view)) return <div className="container py-8"><ErrorState diagnosis={view.error} /></div>;
  if (!isOk(page)) return <div className="container py-8"><ErrorState diagnosis={page.error} /></div>;
  const records = before === null ? page.value.records : pages.flat();
  const next = page.value.nextBefore;
  return (
    <RecordListView
      records={records}
      base={`/desk/${desk?.id ?? id}`}
      nowSec={nowSec}
      zone={zone}
      isOwner={isOwner}
      isLive={desk?.address !== null && desk?.address !== undefined}
      older={next === null ? null : () => { setPages((p) => (before === null ? [page.value.records, []] : [...p, []])); setBefore(next); }}
    />
  );
}
