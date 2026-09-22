"use client";

import Link from "next/link";
import { memo } from "react";
import { RECORD } from "./copy-record";
import { ago } from "./format";
import { Outcome } from "./Outcome";
import type { RecordSummaryWire } from "./protocol";
import "./desk.css";

export interface DeskReelDecision {
  deskId: string;
  record: RecordSummaryWire;
  isLive: boolean;
}

/**
 * "Your desk waited" in the Reels feed (plan §5.2, §5.8): your own desk's latest notable decision, in the take
 * card's grammar (`take.css`) so it reads as part of the feed. Woven in occasionally, never pinned at the top.
 */
export const DeskReelCard = memo(function DeskReelCard({ decision, nowSec }: { decision: DeskReelDecision; nowSec: number }) {
  const R = RECORD.hooks.reel;
  const { record } = decision;
  return (
    <article className="reel-card take-card holding-call" aria-label={`${R.title}: ${record.summary}`}>
      <div aria-hidden className="reel-grain" />
      <div aria-hidden className="reel-heat" />
      <div className="take-author">
        <div className="take-ident">
          <div className="min-w-0">
            <span className="take-name">{R.title}</span>
            <div className="take-meta">
              <Outcome outcome={record.outcome} practice={record.mode === "practice"} /> · {ago(record.decidedAtSec, nowSec)}
            </div>
          </div>
        </div>
        <span className="take-badge">{R.badge}</span>
      </div>
      <div className="take-voice">
        <p className="take-caption">{R.voice(record.summary)}</p>
      </div>
      <div className="take-foot">
        <Link href={`/desk/${decision.deskId}/decision/${record.seq}`} className="take-cta hc-cta" data-cursor="hover">{R.cta}</Link>
        <p className="hc-foot">{R.foot}</p>
      </div>
    </article>
  );
});
