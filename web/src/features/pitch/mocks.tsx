"use client";

import MasayumeMark from "@/components/shell/MasayumeMark";
import { LogoX } from "./marks";
import { PITCH } from "./copy";
import { Rise, Tag } from "./primitives";
import type { CSSProperties } from "react";

/** The tilt rides on a custom property so the rise keyframe can carry it — an inline transform would be overwritten by the animation. */
const tiltStyle = (tilt: number) => ({ "--tilt": `${tilt}deg` }) as CSSProperties;

/**
 * The folio's side visuals — ported from `reference/yosuku/app/pitch/page.tsx` L87–195.
 *
 * Every one of these is a drawn illustration, not product state, and each carries a
 * tag saying so (MOCK · ILLUSTRATIVE, CONCEPT · NOT LIVE). The phone shows Masayume's
 * real UI grammar — the question against the opening print, the chart, UP/DOWN, the
 * stake-first ticket, the 正夢 stamp on a win — so the picture is of the product that
 * exists, with numbers that are plainly a mock's.
 *
 * Colours live in `pitch-slides.css`; the SVG takes its strokes and fills from classes
 * so no hex sits in TSX.
 */

/* the reference's raw points, scaled to the requested width */
const RAW: readonly [number, number][] = [[0, 70], [26, 60], [52, 64], [78, 48], [104, 52], [130, 40], [156, 44], [182, 30], [236, 20]];

export function MiniChart({ w = 236, h = 82, strikeY = 46 }: { w?: number; h?: number; strikeY?: number }) {
  const pts = RAW.map(([x, y]) => [(x / 236) * w, y] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1]}`).join(" ");
  const area = `${d} L${w} ${h} L0 ${h} Z`;
  const last = pts[pts.length - 1]!;
  return (
    <svg width={w} height={h} className="pitch-minichart" aria-hidden>
      <defs>
        <linearGradient id="pitch-cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="pitch-minichart-stop-a" />
          <stop offset="1" className="pitch-minichart-stop-b" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pitch-cg)" />
      <line x1="0" y1={strikeY} x2={w} y2={strikeY} className="pitch-minichart-line" strokeDasharray="3 3" />
      <path d={d} fill="none" className="pitch-minichart-path" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" className="pitch-minichart-tip" />
    </svg>
  );
}

const LockIcon = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className="pitch-lock" strokeWidth="2" aria-hidden>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/** A dark Masayume phone screen — the Window as it is actually laid out, or the verdict that stamps it. */
export function PhoneMock({ tilt = 0, won = false, i = 1 }: { tilt?: number; won?: boolean; i?: number }) {
  return (
    <Rise i={i} className="pitch-phone" style={tiltStyle(tilt)}>
      <Tag>{PITCH.mock}</Tag>
      <div className="pitch-phone-frame">
        <div className="pitch-phone-screen">
          <div className="pitch-phone-status">
            <span>9:41</span>
            <span>◗ ▮</span>
          </div>
          <div className="pitch-phone-app">
            <span className="pitch-phone-brand">
              <MasayumeMark className="pitch-phone-mark" />
              masayume
            </span>
            <span className="pitch-phone-balance">12.74 tUSDC</span>
          </div>
          {won ? (
            <div className="pitch-phone-won">
              <div className="pitch-phone-stamp">正夢</div>
              <div className="pitch-phone-won-label">MASAYUME · IT CAME TRUE</div>
              <div className="pitch-phone-won-figure">+14.60</div>
              <div className="pitch-phone-won-sub">paid to your wallet · settlement receipt ↗</div>
              <div className="pitch-phone-cta">Collect</div>
            </div>
          ) : (
            <>
              <div className="pitch-phone-card">
                <div className="pitch-phone-q">Will BTC close above $64,000?</div>
                <div className="pitch-phone-chart">
                  <MiniChart w={236} h={80} />
                </div>
                <div className="pitch-phone-meta">
                  <span className="up">BTC $64,180 ↑</span>
                  <span>closes in 4:12</span>
                </div>
              </div>
              <div className="pitch-phone-sides">
                <div className="pitch-phone-side up">▲ UP · 64¢</div>
                <div className="pitch-phone-side down">▼ DOWN · 36¢</div>
              </div>
              <div className="pitch-phone-ctawrap">
                <div className="pitch-phone-cta">Place bet · 5.00 tUSDC</div>
              </div>
            </>
          )}
        </div>
      </div>
    </Rise>
  );
}

/** The X post + reply-to-bet card — the Stage-4 rail, drawn as a concept (reference L152–176). */
export function XBetCard({ tilt = 0, i = 1 }: { tilt?: number; i?: number }) {
  return (
    <Rise i={i} className="pitch-xcard" style={tiltStyle(tilt)}>
      <Tag>{PITCH.conceptNotLive}</Tag>
      <div className="pitch-xcard-body">
        <div className="pitch-xcard-author">
          <span className="pitch-xcard-avatar">
            <MasayumeMark className="pitch-xcard-mark" />
          </span>
          <span>
            <span className="pitch-xcard-name">Masayume</span>
            <span className="pitch-xcard-handle">@ — not yet</span>
          </span>
          <span className="pitch-xcard-x">
            <LogoX s={15} />
          </span>
        </div>
        <div className="pitch-xcard-text">Will BTC close above $64,000 by 23:40 UTC?</div>
        <div className="pitch-xcard-embed">
          <div className="pitch-xcard-embed-head">
            <span>MASAYUME · BTC $64,000</span>
            <span className="up">↑ 0.4%</span>
          </div>
          <MiniChart w={296} h={58} strikeY={34} />
        </div>
      </div>
      <div className="pitch-xcard-reply">
        <span className="pitch-xcard-reply-avatar" />
        <span>
          <div className="pitch-xcard-reply-text">
            <span className="handle">@masayume</span> BTC up, 5
          </div>
          <div className="pitch-xcard-receipt">
            <span className="dot" />
            POSITION OPENED · tx 0x…
          </div>
        </span>
      </div>
    </Rise>
  );
}

/** A custodial app with withdrawals frozen — the problem, as a concept (reference L179–195). */
export function FrozenPhone({ tilt = 4, i = 1 }: { tilt?: number; i?: number }) {
  return (
    <Rise i={i} className="pitch-frozen" style={tiltStyle(tilt)}>
      <Tag>{PITCH.concept}</Tag>
      <div className="pitch-frozen-frame">
        <div className="pitch-frozen-screen">
          <div className="pitch-frozen-label">YOUR BALANCE</div>
          <div className="pitch-frozen-balance">$1,240.00</div>
          <div className="pitch-frozen-banner">
            <LockIcon s={17} />
            <span>Withdrawals disabled</span>
          </div>
          <div className="pitch-frozen-bar" />
          <div className="pitch-frozen-foot">A CUSTODIAL APP</div>
        </div>
      </div>
    </Rise>
  );
}
