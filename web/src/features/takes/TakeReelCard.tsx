"use client";

import { formatCadence } from "@masayume/core/copy";
import { formatOracleRaw, secToMs } from "@masayume/core/units";
import { addressUrl, marketDeepLink } from "@masayume/core/urls";
import Link from "next/link";
import { memo, type CSSProperties } from "react";
import { ORACLE_SCALE } from "@/features/markets/hero/units";
import { timeAgo } from "@/features/markets/history/time-ago";
import { addressHue } from "@/lib/address-hue";
import { TAKES } from "./copy";
import type { FeedTake } from "./protocol";

const shortAddress = (address: string): string => (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address || TAKES.anon);

/** The call, from the stored fields: `▲ UP · BTC over $64,316` (reference `callParts`, L27–34). */
function callParts(take: FeedTake): { glyph: string; dir: string; band: string } {
  const line = take.lineRaw === null ? null : `$${formatOracleRaw(BigInt(take.lineRaw), ORACLE_SCALE, 0)}`;
  const band = line === null ? TAKES.noLine(take.asset) : take.side === "up" ? TAKES.over(take.asset, line) : TAKES.under(take.asset, line);
  return take.side === "up" ? { glyph: "▲", dir: "UP", band } : { glyph: "▼", dir: "DOWN", band };
}

interface TakeReelCardProps {
  take: FeedTake;
  /** Chain-corrected clock; 0 before the first client tick, when no relative time is printed. */
  nowMs: number;
}

/**
 * A take as a full-screen reel card — the social sibling of the market card, so the
 * snap scroll reads as one stream of live Windows and community calls. Ported from
 * `reference/yosuku/components/TakeReelCard.tsx`: the caption (the human voice) is
 * the hero; the call frames it; provenance grounds it.
 *
 * Provenance is what changes. The reference's footer says "◆ on Walrus · verify ↗"
 * and links the posting transaction; ours says the take is signed by the wallet and
 * links the author on the explorer, because that is what holds a take here. The
 * reference's "comments soon" is a live link: the Room exists.
 *
 * The frame is `.reel-card`, so it follows the theme exactly as the market card does
 * (the user's 2026-09-01 ruling) — one ink triplet, no dark island.
 */
export const TakeReelCard = memo(function TakeReelCard({ take, nowMs }: TakeReelCardProps) {
  const { glyph, dir, band } = callParts(take);
  const open = nowMs > 0 && secToMs(take.expirySec) > nowMs;
  const otherSide = take.side === "up" ? "down" : "up";

  return (
    <article className="reel-card take-card">
      <div aria-hidden className="reel-grain" />
      <div aria-hidden className="reel-heat" />

      <div className="take-author">
        <div className="take-ident">
          <span aria-hidden className="take-avatar" style={{ "--take-hue": addressHue(take.author) } as CSSProperties} />
          <div className="min-w-0">
            <a href={addressUrl(take.author)} target="_blank" rel="noreferrer" className="take-name" data-cursor="hover">
              {shortAddress(take.author)}
            </a>
            <div className="take-meta">
              {nowMs > 0 ? timeAgo(take.createdAtMs, nowMs) : ""}
              {nowMs > 0 ? " · " : ""}
              {TAKES.window(formatCadence(take.intervalSec))}
            </div>
          </div>
        </div>
        <span className="take-badge" data-backed={take.backed}>
          {take.backed ? TAKES.backed : TAKES.openCall}
        </span>
      </div>

      <div className="take-chip-row">
        <span className="take-chip">
          <span className="take-chip-dir">
            {glyph} {dir}
          </span>
          <span className="take-chip-dot">·</span>
          <span className="take-chip-band">{band}</span>
        </span>
      </div>

      <div className="take-voice">{take.caption ? <p className="take-caption">{take.caption}</p> : <p className="take-caption quiet">{TAKES.noNote}</p>}</div>

      <div className="take-foot">
        <div className="take-prov">
          <span>{TAKES.signed}</span>
          <a href={addressUrl(take.author)} target="_blank" rel="noreferrer" data-cursor="hover">
            {TAKES.verify}
          </a>
          <Link href={marketDeepLink({ marketId: take.marketId })} className="take-prov-room" data-cursor="hover">
            {TAKES.room}
          </Link>
        </div>
        {open ? (
          <Link href={marketDeepLink({ marketId: take.marketId, dir: otherSide })} className="take-cta" data-cursor="hover">
            {TAKES.otherSide}
          </Link>
        ) : (
          <Link href={marketDeepLink({ marketId: take.marketId })} className="take-cta" data-cursor="hover">
            {TAKES.seeWindow}
          </Link>
        )}
      </div>
    </article>
  );
});
