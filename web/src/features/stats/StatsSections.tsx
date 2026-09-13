"use client";

import { shortHex } from "@masayume/core/units";
import { formatBaseUnits } from "@masayume/core/units";
import { addressUrl, txUrl } from "@masayume/core/urls";
import type { ReactNode } from "react";
import { ago, STATS } from "./copy";
import type { TractionEvent } from "./protocol";

interface StatProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}

/** The reference's `Stat` card. */
export function Stat({ label, value, sub, accent }: StatProps) {
  return (
    <div className={accent ? "stat-card accent" : "stat-card"}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

interface SectionHeadProps {
  index: string;
  title: string;
  tag: string;
  right?: ReactNode;
}

/** `01 · Growth · cumulative` — the reference's numbered section head. */
export function SectionHead({ index, title, tag, right }: SectionHeadProps) {
  return (
    <div className={right ? "stats-section-head between" : "stats-section-head"}>
      <div className="stats-section-head-left">
        <span className="stats-section-index">{index}</span>
        <h2 className="stats-section-title">{title}</h2>
        <span className="stats-section-tag">{tag}</span>
      </div>
      {right}
    </div>
  );
}

interface ActivityListProps {
  events: TractionEvent[];
  decimals: number;
  symbol: string;
  nowMs: number;
}

const openTx = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

/**
 * The reference's live-activity rows: dot, kind, wallet, amount, age. The row is a `role="link"`
 * that opens the tx, exactly as the source does — an anchor cannot nest the wallet's own anchor.
 */
export function ActivityList({ events, decimals, symbol, nowMs }: ActivityListProps) {
  return (
    <div className="stats-activity">
      {events.length === 0 && <div className="stats-activity-empty">{STATS.activity.empty}</div>}
      {events.map((event) => {
        const txHref = txUrl(event.txHash);
        return (
          <div
            key={event.id}
            role="link"
            tabIndex={0}
            onClick={() => openTx(txHref)}
            onKeyDown={(e) => {
              if (e.key === "Enter") openTx(txHref);
            }}
            className="stats-row"
            data-cursor="hover"
          >
            <span className={event.kind === "call" ? "stats-dot call" : "stats-dot"} />
            <span className="stats-row-kind">
              {STATS.activity.kind[event.kind]} · {event.side.toUpperCase()} · {event.asset}
            </span>
            <a href={addressUrl(event.wallet)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="stats-row-wallet">
              {shortHex(event.wallet, 6, 4)}
            </a>
            <span className="stats-row-spacer" />
            {event.stakeBase > 0n && (
              <span className="stats-row-amount">
                {formatBaseUnits(event.stakeBase, decimals)} {symbol}
              </span>
            )}
            <span className="stats-row-time">{ago(event.atMs, nowMs)}</span>
            <span className="stats-row-arrow">↗</span>
          </div>
        );
      })}
    </div>
  );
}
