"use client";

import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { oraclePriceText } from "@/features/markets/hero";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import { proofHref } from "@/lib/routes";
import { useWhen } from "@/lib/when";
import { sourceChips, type FeedRow } from "./feed";
import { PROOF_FEED as F } from "./feed-copy";
import { useProofFeed } from "./useProofFeed";
import "./proof-page.css";
import "./proof-feed.css";

/** Rows drawn at first; the rest of the read opens a page at a time. */
const PAGE = 40;
const SKELETON_ROWS = 8;

function FeedRowView({ row, when }: { row: FeedRow; when: (sec: number) => string }) {
  const label = laneAssetLabel(row.asset, row.lane);
  const title = `${label} · ${laneCadenceLabel(row.lane, row.cadenceSec)}`;
  const prints = `${row.openE8 === null ? F.noPrint : oraclePriceText(row.openE8, row.asset)} → ${row.closeE8 === null ? F.noPrint : oraclePriceText(row.closeE8, row.asset)}`;
  const outcome = row.outcome === "void" && row.voidReason ? `${F.outcome.void} · ${F.voidReason[row.voidReason]}` : F.outcome[row.outcome];
  return (
    <li className="pf-row">
      <AssetDisc asset={label} className="pf-mark" />
      <span className="pf-name">
        {/* The row's one link, stretched over the row; the source link sits above it. */}
        <Link href={proofHref(row.market)} className="pf-row-link" data-cursor="hover">
          {title}
        </Link>
        <span className="pf-when">{F.closed(when(row.expirySec))}</span>
      </span>
      <span className="pf-prints numbers">{prints}</span>
      <span className="pf-source">
        {row.sourceName && row.sourceHref ? (
          <a href={row.sourceHref} target="_blank" rel="noreferrer" className="pf-source-link" aria-label={F.sourceAria(row.sourceName)} data-cursor="hover">
            {row.sourceName}
            <span aria-hidden> ↗</span>
          </a>
        ) : (
          (row.sourceName ?? F.noPrint)
        )}
      </span>
      <span className="pf-outcome" data-outcome={row.outcome}>
        {outcome}
      </span>
      <span className="pf-go" aria-hidden>
        {F.open}
      </span>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="pf-list" role="status" aria-busy="true" aria-label={F.loading}>
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <li key={i} className="pf-row pf-row-skeleton">
          <Skeleton className="pf-mark rounded-full" />
          <span className="pf-name">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </span>
          <Skeleton className="pf-prints h-3.5 w-36" />
          <Skeleton className="pf-outcome-skeleton h-5 w-20 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/**
 * `/proof` (S25): the settled Windows across every lane, newest first, each linking to its print proof. Masayume's
 * `/status` frame (numbered header, holding states, the hairline table), with filter chips over the sources the rows
 * actually hold. One cached read, never polled.
 */
export function ProofFeedScreen() {
  const when = useWhen();
  const reading = useProofFeed();
  const [source, setSource] = useState<string>(F.all);
  const [shown, setShown] = useState(PAGE);
  const rows = reading?.ok ? reading.value : null;
  const chips = rows ? sourceChips(rows) : [];
  const active = source === F.all || chips.includes(source) ? source : F.all;
  const filtered = rows ? (active === F.all ? rows : rows.filter((r) => r.sourceName === active)) : [];
  const visible = filtered.slice(0, shown);
  const pick = (next: string) => {
    setSource(next);
    setShown(PAGE);
  };

  return (
    <div className="container status-page proof-page">
      <SectionHeader index={F.section.index} title={F.section.title} desc={F.section.desc} />
      <p className="proof-intro type-body text-ink-secondary">{F.intro}</p>

      {reading !== null && !reading.ok ? (
        <div className="status-holding" role="alert">
          <AlertTriangleIcon className="status-holding-icon warn" aria-hidden />
          <p className="status-holding-text">{F.unreachable}</p>
        </div>
      ) : (
        <div className="status-report">
          {chips.length > 0 && (
            <div className="pf-chips" role="group" aria-label={F.filters}>
              {[F.all, ...chips].map((chip) => (
                <button key={chip} type="button" className="pf-chip" aria-pressed={chip === active} onClick={() => pick(chip)} data-cursor="hover">
                  {chip}
                </button>
              ))}
            </div>
          )}
          <div className="status-table">
            <div className="status-table-head">
              <h3 className="status-table-title">{rows ? F.tableTitle(visible.length, filtered.length) : F.loading}</h3>
            </div>
            {rows === null ? (
              <SkeletonRows />
            ) : filtered.length === 0 ? (
              <p className="pf-empty">{active === F.all ? F.none : F.noneFor(active)}</p>
            ) : (
              <ul className="pf-list">
                {visible.map((row) => (
                  <FeedRowView key={row.market} row={row} when={when} />
                ))}
              </ul>
            )}
          </div>
          {filtered.length > visible.length && (
            <button type="button" className="pf-more" onClick={() => setShown((n) => n + PAGE)} data-cursor="hover">
              {F.more(Math.min(PAGE, filtered.length - visible.length))}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
