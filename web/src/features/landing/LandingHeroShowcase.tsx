"use client";

import { BASKETS, BASKET_INDEX_BASE_E8 } from "@agari/core/market";
import { useAssetPrice } from "@agari/markets/react";
import Link from "next/link";
import { AgariMark } from "@/components/shell";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { oraclePriceText } from "@/features/markets/hero";
import { basisRaw, feedRawToOracleRaw, pointsLine } from "@/features/markets/hero/units";
import { laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import { useProofFeed } from "@/features/proof/useProofFeed";
import { usePreIpoFactsAll } from "@/features/ticker-hub/usePreIpoFacts";
import { proofHref } from "@/lib/routes";

const basket = BASKETS.AILABS;

const recordedExamples = [
  { asset: "AILABS", name: "AI Labs", cadence: "1h · PreStocks", prices: "1,267.38 → 1,110.43 pts", outcome: "Down won", href: "https://explorer.solana.com/tx/5xkJKmS47fZBYRNyeJ83iffHTxzpE2vMr9SGBMvKb3eeN6wNh1xC3WeWYpknWAynR1mAjmKF2ZpVEWwRU3RuZm3f?cluster=devnet" },
  { asset: "DEFSPACE", name: "Defense & Space", cadence: "1h · PreStocks", prices: "980.93 → 988.06 pts", outcome: "Up won", href: "https://explorer.solana.com/tx/YnwMzy8g1Fp6KkRrFTF3XHTEWhF7JgK4Y3FGAidnzR2B2uzYwgpe8SmPPafQqNcqUgvp9yjf721qghLrsznBdP4?cluster=devnet" },
] as const;

/** Real HTML product surfaces, using the same price and proof reads as the basket and Proof pages. */
export function LandingHeroShowcase() {
  const basketPrice = useAssetPrice(basket.symbol);
  const basketFacts = usePreIpoFactsAll(true);
  const proofFeed = useProofFeed();
  const streamedIndex = basketPrice?.ok && basketPrice.value
    ? feedRawToOracleRaw(basisRaw(basketPrice.value), basketPrice.value.decimals)
    : null;
  const indexRaw = streamedIndex ?? (basketFacts?.ok ? basketFacts.value[basket.symbol]?.indexE8 ?? null : null);
  const recentRows = proofFeed?.ok
    ? proofFeed.value.filter((row) => row.openE8 !== null && row.closeE8 !== null).slice(0, 3)
    : [];
  const proofRows = recentRows.length > 0
    ? recentRows.map((row) => ({
        asset: row.asset,
        name: laneAssetLabel(row.asset, row.lane),
        cadence: `${laneCadenceLabel(row.lane, row.cadenceSec)} · ${row.sourceName ?? "Price print"}`,
        prices: `${oraclePriceText(row.openE8!, row.asset)} → ${oraclePriceText(row.closeE8!, row.asset)}`,
        outcome: row.outcome === "void" ? "Void" : `${row.outcome === "up" ? "Up" : "Down"} won`,
        href: proofHref(row.market),
      }))
    : recordedExamples;

  return (
    <div className="lp-hero-art" role="group" aria-label="Agari basket and settlement proof previews">
      <section className="lp-screen lp-screen-proof" aria-labelledby="lp-preview-proof-heading">
        <div className="lp-screen-chrome" aria-hidden="true"><i /><i /><i /></div>
        <div className="lp-preview-proof-body">
          <div className="lp-preview-rail">
            <span>00 · Settlement proof</span>
            <Link href="/proof" aria-label="Open all settlement proof" data-cursor="hover">All proof ↗</Link>
          </div>
          <h2 id="lp-preview-proof-heading">Proof</h2>
          <p>Every settled Window, with the prints that decided it.</p>
          <div className="lp-preview-filters" aria-hidden="true"><span>All</span><span>PreStocks</span><span>Pyth</span></div>
          <div className="lp-preview-proof-table">
            <div className="lp-preview-table-label">{recentRows.length > 0 ? "Recent settlements" : "Verified examples · 22 Sep"}</div>
            {proofRows.map((row) => (
              <a key={row.href} href={row.href} target={row.href.startsWith("https:") ? "_blank" : undefined} rel={row.href.startsWith("https:") ? "noreferrer" : undefined} className="lp-preview-proof-row" data-cursor="hover">
                <AssetDisc asset={row.asset} className="lp-preview-row-mark" />
                <span className="lp-preview-row-name"><strong>{row.name}</strong><small>{row.cadence}</small></span>
                <span className="lp-preview-row-prices numbers">{row.prices}</span>
                <span className="lp-preview-outcome" data-outcome={row.outcome.startsWith("Up") ? "up" : row.outcome.startsWith("Down") ? "down" : "void"}>{row.outcome}</span>
                <span className="lp-preview-row-arrow" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-screen lp-screen-baskets" aria-labelledby="lp-preview-basket-heading">
        <div className="lp-screen-chrome" aria-hidden="true"><i /><i /><i /></div>
        <div className="lp-preview-basket-body">
          <div className="lp-preview-rail">
            <span><AgariMark /> Agari / 01 · Baskets</span>
            <Link href="/baskets" aria-label="Open all PreStocks baskets" data-cursor="hover">Explore ↗</Link>
          </div>
          <div className="lp-preview-basket-head">
            <AssetDisc asset={basket.symbol} className="lp-preview-basket-mark" />
            <div><h2 id="lp-preview-basket-heading">{basket.name}</h2><span>${basket.symbol}</span></div>
          </div>
          <p className="lp-preview-basket-blurb">{basket.blurb}</p>
          <div className="lp-preview-members">
            <div className="lp-preview-member-marks">{basket.members.map((member) => <AssetDisc key={member.symbol} asset={member.symbol} className="lp-preview-member-mark" />)}</div>
            <span>{basket.members.length} companies · equal weight</span>
          </div>
          <div className="lp-preview-index">
            <span>{indexRaw === null ? "Index base · 22 Sep" : "Live PreStocks basket index"}</span>
            <strong className="numbers" aria-live="polite">{pointsLine(indexRaw ?? BASKET_INDEX_BASE_E8)}</strong>
            <small>{indexRaw === null ? "Open Baskets for the current quote" : "Current quote · settles from signed prints"}</small>
          </div>
          <div className="lp-preview-window"><span className="lp-preview-live-dot" />24/7 · one-hour Windows <Link href="/baskets" data-cursor="hover">View market →</Link></div>
          <div className="lp-preview-actions">
            <Link href="/baskets" data-cursor="hover">Predict</Link>
            <Link href="/portfolio" data-cursor="hover">Cover</Link>
            <Link href="/desk/new?basket=AILABS" data-cursor="hover">Hold</Link>
          </div>
        </div>
      </section>
      <span className="lp-art-caption">Markets · Settle · Higher</span>
    </div>
  );
}
