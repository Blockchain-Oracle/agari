"use client";

import type { ReserveSheet } from "@agari/core/reserves";
import { CapabilityPending } from "@/components/shell";
import { EARN } from "./copy";
import { ReservePanel } from "./ReservePanel";
import type { ReserveWords } from "./reserves";

/**
 * The reference renders the hero at once and lets the panel say "loading the vault…" (page.tsx L222–224).
 * The accented word is the tab's: what supplying this particular reserve earns.
 */
export function Hero({ words, sheet, symbol, status }: { words: ReserveWords; sheet: ReserveSheet | null; symbol: string; status?: string }) {
  return (
    <section className="page-hero">
      <span className="crop tl" />
      <span className="crop tr" />
      <span className="crop bl" />
      <span className="crop br" />
      <div className="container">
        <div className="hero-grid">
          <div className="hero-left">
            <h1 className="page-title">
              {EARN.title}
              <br />
              <span className="accent">{words.accent}</span>.
            </h1>
            <p className="ea-blurb">{words.blurb}</p>
          </div>
          <ReservePanel sheet={sheet} symbol={symbol} words={words} status={status} />
        </div>
      </div>
    </section>
  );
}

export function NotDeployed() {
  const { notDeployed } = EARN;
  return (
    <div className="container">
      <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
        <p>{notDeployed.body}</p>
        <p>{notDeployed.why}</p>
      </CapabilityPending>
    </div>
  );
}
