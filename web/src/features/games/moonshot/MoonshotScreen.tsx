"use client";

import type { RangeReserveState } from "@masayume/core/range";
import { isOk } from "@masayume/core/schemas";
import { useRangeReserve } from "@masayume/markets/react";
import { CapabilityPending, SectionHead } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useVenue } from "../../markets/useVenue";
import { RangeSlip } from "../../range/RangeSlip";
import { MOONSHOT } from "./copy";
import { MoonshotBuilder } from "./MoonshotBuilder";
import "../../parlay/parlay-page.css";
import "../../parlay/parlay-builder.css";
import "../../parlay/parlay-ticket.css";
import "../../range/range-band.css";
import "../../range/range-page.css";
import "./moonshot.css";

/** `/games/moonshot` — Pips' aim-and-fire call on the Range page's frame, over the same live reserve. */
export function MoonshotScreen() {
  const reading = useRangeReserve();
  return (
    <div className="container pl-page">
      <ReadingBoundary reading={reading} shape="plate">
        {(state) => (state ? <Page reserve={state} /> : <NotDeployed />)}
      </ReadingBoundary>
    </div>
  );
}

function NotDeployed() {
  const { notDeployed } = MOONSHOT;
  return (
    <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
      <p>{notDeployed.body}</p>
      <p>{notDeployed.why}</p>
    </CapabilityPending>
  );
}

function Page({ reserve }: { reserve: RangeReserveState }) {
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const { sections } = MOONSHOT;
  return (
    <>
      <div className="pl-hero">
        <span className="pl-eyebrow">{MOONSHOT.eyebrow}</span>
        <h1 className="page-title">
          {MOONSHOT.title}
          <span className="accent">.</span>
        </h1>
      </div>

      <section className="pl-block" aria-label={sections.aim.title}>
        <SectionHead number={sections.aim.number} title={sections.aim.title} desc={sections.aim.desc} />
        <div className="pl-block-body">
          <MoonshotBuilder reserve={reserve} symbol={symbol} />
        </div>
      </section>

      <section className="pl-block" aria-label={sections.rounds.title}>
        <SectionHead number={sections.rounds.number} title={sections.rounds.title} desc={sections.rounds.desc} />
        <div className="pl-block-body">
          <RangeSlip kind="moonshot" empty={MOONSHOT.slip} symbol={symbol} decimals={reserve.decimals} staleAfterSec={reserve.params.staleAfterSec} />
        </div>
      </section>

      <section className="pl-block" aria-label={sections.how.title}>
        <SectionHead number={sections.how.number} title={sections.how.title} />
        <div className="pl-block-body pl-how">
          {MOONSHOT.how.map((card) => (
            <div key={card.n} className="pl-how-card">
              <div className="pl-how-n">{card.n}</div>
              <div className="pl-how-t">{card.t}</div>
              <div className="pl-how-d">{card.d}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
