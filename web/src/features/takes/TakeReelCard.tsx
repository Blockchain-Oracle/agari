"use client";

import { formatCadence } from "@agari/core/copy";
import { assetTicker } from "@agari/core/market";
import { secToMs } from "@agari/core/units";
import { addressUrl, marketDeepLink } from "@agari/core/urls";
import Link from "next/link";
import { memo, type CSSProperties } from "react";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { assetPriceLine } from "@/features/markets/hero/units";
import { timeAgo } from "@/features/markets/history/time-ago";
import { addressHue } from "@/lib/address-hue";
import { captionParts, profileHref, tickerHref } from "./cashtags";
import { TAKES } from "./copy";
import type { FeedTake } from "./protocol";
import "./take-cashtag.css";

const shortAddress = (address: string): string => (address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address || TAKES.anon);

/**
 * The call, from the stored fields: `▲ UP · $TSLA over $359.07` (reference `callParts`, L27–34). The band's asset is
 * cut off its front so the chip can set it as a cashtag (D-082); the words after it are the reference's own.
 */
function callParts(take: FeedTake): { glyph: string; dir: string; tail: string } {
  const line = take.lineRaw === null ? null : assetPriceLine(take.asset, BigInt(take.lineRaw));
  const band = line === null ? TAKES.noLine(take.asset) : take.side === "up" ? TAKES.over(take.asset, line) : TAKES.under(take.asset, line);
  const tail = band.startsWith(take.asset) ? band.slice(take.asset.length) : ` ${band}`;
  return take.side === "up" ? { glyph: "▲", dir: "UP", tail } : { glyph: "▼", dir: "DOWN", tail };
}

/** The call chip: the asset's mark, the direction, then `$TSLA` as a link to its hub (a token links to its underlying's). */
function CallChip({ take }: { take: FeedTake }) {
  const { glyph, dir, tail } = callParts(take);
  const hub = assetTicker(take.asset);
  return (
    <span className="take-chip">
      <AssetDisc asset={take.asset} className="take-chip-mark" />
      <span className="take-chip-dir">
        {glyph} {dir}
      </span>
      <span className="take-chip-dot">·</span>
      <span className="take-chip-band">
        {hub ? (
          <Link href={tickerHref(hub.ticker.symbol)} className="take-cashtag take-chip-tag" data-cursor="hover">
            ${take.asset}
          </Link>
        ) : (
          <span className="take-chip-tag">${take.asset}</span>
        )}
        {tail}
      </span>
    </span>
  );
}

/** The caption with each registry `$TICKER` as a link to its ticker hub; any other `$` word stays text. */
function Caption({ caption }: { caption: string }) {
  return (
    <p className="take-caption">
      {captionParts(caption).map((part, index) =>
        "symbol" in part ? (
          <Link key={index} href={tickerHref(part.symbol)} className="take-cashtag" data-cursor="hover">
            {part.text}
          </Link>
        ) : (
          part.text
        ),
      )}
    </p>
  );
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
 * reference's "comments soon" is a live link: the Room exists. The author's name opens
 * their profile, and a caption's cashtags open their ticker hubs. The call chip carries
 * the asset's mark and names it as a cashtag (D-082); caption, avatar and provenance are
 * the reference's.
 *
 * The frame is `.reel-card`, so it follows the theme exactly as the market card does
 * (the user's 2026-09-01 ruling) — one ink triplet, no dark island.
 */
export const TakeReelCard = memo(function TakeReelCard({ take, nowMs }: TakeReelCardProps) {
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
            <Link href={profileHref(take.author)} className="take-name" data-cursor="hover">
              {shortAddress(take.author)}
            </Link>
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
        <CallChip take={take} />
      </div>

      <div className="take-voice">{take.caption ? <Caption caption={take.caption} /> : <p className="take-caption quiet">{TAKES.noNote}</p>}</div>

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
