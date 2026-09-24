"use client";

import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import type { ReactNode } from "react";
import { CONTROLS, MONEY } from "./copy-controls";
import { stamp } from "./format";
import type { DeskPhase } from "./useDeskWrites";

export interface ControlCardProps {
  title: string;
  body: string;
  now: string[];
  after: string[];
  who: "wallet" | "message" | "request";
  /** Money can move: the network is named on the card. */
  money?: boolean;
  expiresAtSec: number;
  nowSec: number;
  zone: string | null;
  phase: DeskPhase;
  problem: string | null;
  signature: Signature | null;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
  disabled?: boolean;
  done?: string | null;
  children?: ReactNode;
}

/**
 * The card every control shows first (plan §5.7 item 9, Shijima's `ProposalCard` in Masayume's receipt shape):
 * what changes, Now → After, who signs, when the card expires. Nothing happens until Confirm, and the outcome is
 * written on the same card.
 */
export function ControlCard(p: ControlCardProps) {
  const C = CONTROLS.card;
  const expired = p.nowSec > p.expiresAtSec && p.phase !== "done";
  const busy = p.phase === "signing" || p.phase === "sending" || p.phase === "confirming";
  return (
    <div className="dk-card" data-tone={p.phase === "done" ? "good" : p.phase === "failed" ? "bad" : undefined}>
      {p.money && <span className="dk-eyebrow" data-live="">{MONEY.eyebrow}</span>}
      <strong className="dk-holding-name">{p.title}</strong>
      <p className="type-caption text-ink-secondary">{p.body}</p>
      {p.children}
      {(p.now.length > 0 || p.after.length > 0) && (
        <dl className="dk-card-diff" data-single={p.now.length === 0 ? "" : undefined}>
          {p.now.length > 0 && (
            <div>
              <dt>{C.now}</dt>
              {p.now.map((line) => (
                <dd key={`n-${line}`}>{line}</dd>
              ))}
            </div>
          )}
          <div>
            <dt>{C.after}</dt>
            {p.after.map((line) => (
              <dd key={`a-${line}`}>{line}</dd>
            ))}
          </div>
        </dl>
      )}
      <p className="type-caption text-ink-muted">
        {C.who[p.who]}
        {p.money ? ` · ${MONEY.network}` : ""}
      </p>
      {p.phase === "done" ? (
        <p className="type-body text-ink">
          {p.done ?? C.done}{" "}
          {p.signature && (
            <a href={txUrl(p.signature, "mainnet-beta")} target="_blank" rel="noopener noreferrer" className="dk-link">{C.doneTx}</a>
          )}
        </p>
      ) : p.phase === "failed" ? (
        <p className="type-body dk-warn">{C.failed(p.problem ?? "")}</p>
      ) : expired ? (
        <p className="type-caption text-ink-muted">{C.expired}</p>
      ) : null}
      <div className="dk-card-actions">
        {p.phase !== "done" && !expired && (
          <button type="button" className="dk-control" data-tone="primary" disabled={busy || p.disabled} onClick={p.onConfirm}>
            {p.phase === "signing" ? C.confirming : busy ? C.sending : (p.confirmLabel ?? C.confirm)}
          </button>
        )}
        <button type="button" className="dk-control" onClick={p.onClose} disabled={busy}>{p.phase === "done" ? "Close" : C.notNow}</button>
        {p.phase === "idle" && !expired && <span className="type-caption text-ink-muted">{C.expires(stamp(p.expiresAtSec, p.zone))}</span>}
      </div>
    </div>
  );
}
