"use client";

import type { RangeReserveState } from "@agari/core/range";
import { isOk } from "@agari/core/schemas";
import { useRangeReserve } from "@agari/markets/react";
import { CapabilityPending, SectionHead } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useVenue } from "../markets/useVenue";
import { RANGE } from "./copy";
import { RangeBuilder } from "./RangeBuilder";
import { RangeSlip } from "./RangeSlip";
import "../parlay/parlay-page.css";
import "../parlay/parlay-builder.css";
import "../parlay/parlay-ticket.css";
import "./range-band.css";
import "./range-page.css";

/** `/games/range` — the reference has no range page; this is its Ticket's range mode on the parlay page's frame. */
export function RangeScreen() {
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
  const { notDeployed } = RANGE;
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
  const { sections } = RANGE;
  return (
    <>
      <div className="pl-hero">
        <span className="pl-eyebrow">{RANGE.eyebrow}</span>
        <h1 className="page-title">
          {RANGE.title}
          <span className="accent">.</span>
        </h1>
      </div>

      <section className="pl-block" aria-label={sections.build.title}>
        <SectionHead number={sections.build.number} title={sections.build.title} desc={sections.build.desc} />
        <div className="pl-block-body">
          <RangeBuilder reserve={reserve} symbol={symbol} />
        </div>
      </section>

      <section className="pl-block" aria-label={sections.rounds.title}>
        <SectionHead number={sections.rounds.number} title={sections.rounds.title} desc={sections.rounds.desc} />
        <div className="pl-block-body">
          <RangeSlip kind="range" symbol={symbol} decimals={reserve.decimals} staleAfterSec={reserve.params.staleAfterSec} />
        </div>
      </section>

      <section className="pl-block" aria-label={sections.how.title}>
        <SectionHead number={sections.how.number} title={sections.how.title} />
        <div className="pl-block-body pl-how">
          {RANGE.how.map((card) => (
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
