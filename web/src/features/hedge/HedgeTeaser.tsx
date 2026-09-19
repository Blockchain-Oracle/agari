"use client";

import { TICKERS } from "@agari/core/market";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { HEDGE } from "./copy";
import type { HedgeCardState } from "./hedge-state";
import "./hedge.css";

interface HedgeTeaserProps {
  state: Exclude<HedgeCardState, { kind: "offer" }>;
  onExample: () => void;
}

/**
 * The cover card with no offer to make, in the same banner anatomy as the offer (plan Step 2). It always says what the
 * feature is and offers the example, so a visitor with no wallet, no holding or no open Window still learns it exists.
 */
export function HedgeTeaser({ state, onExample }: HedgeTeaserProps) {
  const words =
    state.kind === "no-window"
      ? HEDGE.teaser.noWindow(TICKERS[state.lead.underlying].name)
      : state.kind === "calm"
        ? HEDGE.teaser.calm(TICKERS[state.lead.underlying].name)
        : HEDGE.teaser[teaserKey(state.kind)];
  return (
    <article className="hg-banner" data-kind="teaser" data-state={state.kind} aria-label={`${words.name}. ${words.line}`}>
      {state.kind === "no-window" || state.kind === "calm" ? (
        <AssetDisc asset={state.lead.underlying} className="hg-banner-mark" />
      ) : (
        <span className="hg-banner-mark" aria-hidden>
          ↓
        </span>
      )}
      <div className="hg-banner-text">
        <span className="hg-banner-eyebrow">{HEDGE.teaser.eyebrow}</span>
        <span className="hg-banner-name">{words.name}</span>
        <span className="hg-banner-line">{words.line}</span>
      </div>
      <button type="button" className="hg-banner-cta hg-banner-button" onClick={onExample}>
        {HEDGE.example.show} →
      </button>
      <p className="hg-banner-foot">{HEDGE.teaser.foot}</p>
    </article>
  );
}

const teaserKey = (kind: "no-wallet" | "reading" | "unreadable" | "no-holding") =>
  kind === "no-wallet" ? "noWallet" : kind === "reading" ? "reading" : kind === "unreadable" ? "unreadable" : "noHolding";
