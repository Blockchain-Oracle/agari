"use client";

import { presetById } from "@agari/core/desk";
import { isOk } from "@agari/core/schemas";
import { ArrowUpRight, CircleDashed } from "lucide-react";
import Link from "next/link";
import { EmptyState, LogoStack, NumberTicker, Sparkline, StatusDot } from "@/components/ui/desk-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { TONE } from "../activity/ActivityTimeline";
import { DESK } from "../copy";
import { RECORD } from "../copy-record";
import { ago } from "../format";
import { useDeskView } from "../useDesk";
import { deskView, type DeskView } from "../view";
import { ENTRY } from "./copy-entry";

const P = ENTRY.preview;

/** Display only: E6 money as dollars for the rolling figure and the sparkline. */
const dollars = (e6: bigint): number => Number(e6) / 1e6;

/**
 * A live card of a desk its owner shares (S22): read through the same query as the desk page, so opening it is
 * instant. The basket, the total with its line, the mode, and the latest check in its tone. Never a made-up figure:
 * while it loads it is a skeleton, and when it cannot be read it says so.
 */
export function SharedDeskPreview({ id }: { id: string }) {
  const reading = useDeskView(id, null);
  if (reading === null) return <Skeleton className="en-preview en-preview-skel" />;
  if (!isOk(reading)) return <div className="en-preview"><EmptyState icon={<CircleDashed />} title={P.unavailable} /></div>;
  return <SharedDeskCard id={id} view={deskView(reading.value)} />;
}

/** The card itself, from a desk view (the fixtures pass one). */
export function SharedDeskCard({ id, view }: { id: string; view: DeskView }) {
  const preset = view.mandate?.preset ? presetById(view.mandate.preset) : null;
  const symbols = view.mandate ? view.mandate.targets.tokens.map((t) => t.symbol) : view.holdings.map((h) => h.symbol);
  const latest = view.wire.latest;
  const tone = latest ? TONE[latest.outcome] : null;
  const line = view.series.map((p) => dollars(p.totalE6));
  return (
    <Link href={`/desk/${id}`} className="en-preview" data-cursor="hover">
      <span className="en-preview-head">
        {preset ? <AssetDisc asset={preset.basket} className="en-preview-basket" /> : <LogoStack symbols={symbols} size="md" />}
        <span className="en-preview-name">
          <span className="en-kicker">{P.kicker}</span>
          <b>{preset?.name ?? DESK.visitorTitle}</b>
        </span>
        <StatusDot tone={view.isLive ? "live" : "practice"}>{DESK.modes[view.mode]}</StatusDot>
      </span>
      <span className="en-preview-value">
        <span className="en-kicker">{P.total}</span>
        {view.plate.totalE6 !== null ? <NumberTicker value={dollars(view.plate.totalE6)} className="en-preview-figure" /> : <span className="en-preview-figure">—</span>}
        {line.length > 1 && <Sparkline values={line} width={320} height={48} className="en-preview-spark" />}
      </span>
      {symbols.length > 0 && <LogoStack symbols={symbols} size="sm" max={8} />}
      {latest && tone && (
        <span className="en-preview-latest" data-tone={tone}>
          <span className="en-kicker">{P.latest} · {ago(latest.decidedAtSec, view.wire.nowSec)}</span>
          <span className="en-preview-verdict" data-tone={tone}>{RECORD.outcome[latest.outcome]}</span>
          <span className="en-preview-summary">{latest.summary}</span>
        </span>
      )}
      <span className="en-preview-foot">
        <span>{P.checks(latest?.seq ?? 0)}</span>
        <span className="en-preview-open">{P.open}<ArrowUpRight aria-hidden /></span>
      </span>
    </Link>
  );
}
