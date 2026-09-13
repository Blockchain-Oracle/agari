"use client";

import { formatBaseUnits, formatClock, formatUtc, remainingSec, secToMs } from "@masayume/core/units";
import { txUrl } from "@masayume/core/urls";
import type { ReactNode } from "react";
import { callBandLabel, callDirLabel, callMultiple, callWinBase, shortCallId, type CallCard } from "./call-card";
import { SHARE } from "./copy";
import { ShareCallButton } from "./ShareCallButton";

interface CallPlacedCardProps {
  card: CallCard;
  /** Ticking clock (ms) — the parent owns the interval so the countdown stays live. */
  nowMs: number;
  /** Secondary buttons rendered under the share CTA (portfolio / place another). */
  actions?: ReactNode;
}

/**
 * The Call — the shareable card shown the instant a bet lands, ported from
 * `reference/yosuku/components/BetPlacedCard.tsx`. The live-position sibling of the
 * settlement receipt: same ground, grain and registration ticks, but the vermilion
 * heat reads as conviction, not a win. The clock is alive — a ticking countdown over
 * a draining bar — because the call is still open.
 *
 * Honesty mirrors the PNG: no result is implied, the return is conditional ("win if
 * it lands") and net of the settlement fee when known, and the settle time is the
 * Window's real expiry. The reference pins the ticket dark; here it follows the
 * theme (share-card.css), on the user's 2026-09-01 ruling — the PNG stays dark.
 */
export function CallPlacedCard({ card, nowMs, actions }: CallPlacedCardProps) {
  const left = nowMs > 0 ? remainingSec(nowMs, card.expirySec) : null;
  const total = card.expirySec - Math.floor(card.placedAtMs / 1000);
  const drain = left === null ? null : total <= 0 ? 0 : Math.max(0, Math.min(1, left / total));

  return (
    <div>
      <div className="call-card">
        <div aria-hidden className="call-grain" />
        <div aria-hidden className="call-spark" />
        <span aria-hidden className="call-tick tl" />
        <span aria-hidden className="call-tick tr" />
        <span aria-hidden className="call-tick bl" />
        <span aria-hidden className="call-tick br" />

        <div className="call-body">
          <div className="call-masthead">
            <span className="call-brand">{SHARE.brand}</span>
            <span className="call-folio">N° {shortCallId(card)}</span>
          </div>
          <div className="call-rule" />

          <div className="call-eyebrow">
            <span>{callDirLabel(card)}</span>
            <span className="call-eyebrow-dot">·</span>
            <span className="call-eyebrow-note">{SHARE.call.placed}</span>
          </div>
          <h3 className="call-band">{callBandLabel(card)}</h3>
          <p className="call-wins-if">{SHARE.call.winsIf(card.asset, card.side)}</p>

          <div className="call-wager">
            <div className="min-w-0">
              <div className="call-label">{SHARE.call.youStake}</div>
              <div className="call-figure">{formatBaseUnits(card.stakeBase, card.decimals)}</div>
            </div>
            <div className="call-arrow" aria-hidden>
              →
            </div>
            <div className="min-w-0 text-right">
              <div className="call-label">{SHARE.call.winIfLands}</div>
              <div className="call-figure heat">
                {formatBaseUnits(callWinBase(card), card.decimals)}
                {card.leverage && <span className="call-lev-mark"> ✦</span>}
              </div>
            </div>
          </div>
          <p className="call-fee-note">
            {card.symbol}
            {card.feeBps !== null ? ` · ${SHARE.call.afterFee}` : ""}
          </p>
          {card.leverage && <p className="call-lev-note">{SHARE.call.leverageNote(callMultiple(card))}</p>}

          <div className="call-settles">
            <div className="call-settles-row">
              <span className="call-label">{SHARE.call.settlesIn}</span>
              <span className="call-utc">{formatUtc(secToMs(card.expirySec))}</span>
            </div>
            <div className="call-clock">
              <span className="call-ping" aria-hidden>
                <span />
              </span>
              <span className="call-countdown">{left === null ? "—" : left === 0 ? SHARE.call.settling : formatClock(left)}</span>
            </div>
            {drain !== null && (
              <div className="call-drain">
                <div className="call-drain-fill" style={{ width: `${drain * 100}%` }} />
              </div>
            )}
          </div>

          <a href={txUrl(card.txHash)} target="_blank" rel="noreferrer" className="call-verify" data-cursor="hover">
            {SHARE.call.verify}
          </a>
        </div>
      </div>

      <ShareCallButton card={card} variant="primary" />
      {actions}
    </div>
  );
}
