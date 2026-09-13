"use client";

import type { ParlayReserveState } from "@masayume/core/parlay";
import { isOk } from "@masayume/core/schemas";
import { useParlayReserve } from "@masayume/markets/react";
import { CapabilityPending, SectionHead } from "@/components/shell";
import { ReadingBoundary } from "@/components/states";
import { useVenue } from "../markets/useVenue";
import { PARLAY } from "./copy";
import { ParlayBuilder } from "./ParlayBuilder";
import { ParlaySlip } from "./ParlaySlip";
import "./parlay-page.css";
import "./parlay-builder.css";
import "./parlay-ticket.css";

/** `/parlay` — `reference/yosuku/app/parlay/page.tsx`: the hero, the builder, the slip, how it pays. */
export function ParlayScreen() {
  const reading = useParlayReserve();
  return (
    <div className="container pl-page">
      <ReadingBoundary reading={reading} shape="plate">
        {(state) => (state ? <Page reserve={state} /> : <NotDeployed />)}
      </ReadingBoundary>
    </div>
  );
}

function NotDeployed() {
  const { notDeployed } = PARLAY;
  return (
    <CapabilityPending eyebrow={notDeployed.eyebrow} title={notDeployed.title} dependency={notDeployed.dependency}>
      <p>{notDeployed.body}</p>
      <p>{notDeployed.why}</p>
    </CapabilityPending>
  );
}

function Page({ reserve }: { reserve: ParlayReserveState }) {
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const { sections } = PARLAY;
  return (
    <>
      <div className="pl-hero">
        <span className="pl-eyebrow">{PARLAY.eyebrow}</span>
        <h1 className="page-title">
          {PARLAY.title}
          <span className="accent">.</span>
        </h1>
      </div>

      <section className="pl-block" aria-label={sections.build.title}>
        <SectionHead number={sections.build.number} title={sections.build.title} desc={sections.build.desc} />
        <div className="pl-block-body">
          <ParlayBuilder reserve={reserve} symbol={symbol} />
        </div>
      </section>

      <section className="pl-block" aria-label={sections.tickets.title}>
        <SectionHead number={sections.tickets.number} title={sections.tickets.title} desc={sections.tickets.desc} />
        <div className="pl-block-body">
          <ParlaySlip symbol={symbol} decimals={reserve.decimals} />
        </div>
      </section>

      <section className="pl-block" aria-label={sections.how.title}>
        <SectionHead number={sections.how.number} title={sections.how.title} />
        <div className="pl-block-body pl-how">
          {PARLAY.how.map((c) => (
            <div key={c.n} className="pl-how-card">
              <div className="pl-how-n">{c.n}</div>
              <h3 className="pl-how-t">{c.t}</h3>
              <p className="pl-how-d">{c.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
