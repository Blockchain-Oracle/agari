"use client";

import { PINNED_TESTNET } from "@masayume/markets";
import Link from "next/link";
import { PITCH } from "./copy";
import { LogoCard, SomniaMark } from "./marks";
import { FrozenPhone, PhoneMock, XBetCard } from "./mocks";
import { CountUp, Emph, Glance, Kicker, Mono, Pill, Rise, SpecPanel } from "./primitives";
import type { Slide } from "./types";

/**
 * Slides 01–08 — ported from `reference/yosuku/app/pitch/page.tsx` L281–469, layout
 * for layout. The words are Masayume's and every claim has a source named in
 * `copy.ts`; where the reference asserts something we do not have (a live X rail, a
 * card on-ramp, native apps) the slide keeps its place and says NEXT or NOT LIVE.
 */

const shortAddr = (a: string) => a.slice(0, 10);

const C = PITCH.cover;
const E = PITCH.engine;
const G = PITCH.gap;
const D = PITCH.edge;
const X = PITCH.x;
const P = PITCH.proof;
const O = PITCH.onboard;
const M = PITCH.mobile;

export const SLIDES_A: Slide[] = [
  // 01 · COVER (at a glance)
  {
    id: "glance",
    section: C.section,
    render: () => (
      <div className="pitch-row pitch-row-between">
        <div className="pitch-col pitch-col-52">
          <Rise className="pitch-h1 pitch-h1-cover">
            {C.h1a}
            <br />
            {C.h1b}
            <Emph delay={0.7}>{C.emph}</Emph>.
          </Rise>
          <Rise i={1} className="pitch-lead pitch-lead-50">
            {C.lead} <span className="ink">{C.leadStrong}</span>
          </Rise>
          <Rise i={2} className="pitch-pills">
            <Pill tone="live">{C.pills[0]}</Pill>
            <Pill>{C.pills[1]}</Pill>
            <Pill tone="verm">{C.pills[2]}</Pill>
          </Rise>
        </div>
        <Glance
          i={3}
          title={C.glanceTitle}
          badge={C.glanceBadge}
          rows={[
            C.rows.betOn,
            C.rows.where,
            [C.rows.engine[0], C.rows.engine[1], true],
            [C.rows.custody[0], C.rows.custody[1], true],
            // The reference draws Google + a card here (zkLogin, Paystack); neither exists
            // on this stack, so the row says what onboarding actually is today.
            C.rows.onboarding,
            [
              C.rows.builtOn,
              <span key="bo" className="pitch-glance-marks">
                <SomniaMark s={20} />
                <span className="pitch-glance-val">{C.rows.chain}</span>
              </span>,
            ],
          ]}
        />
      </div>
    ),
  },

  // 02 · THE ENGINE (DreamDEX did the hard part)
  {
    id: "engine",
    section: E.section,
    paper: 2,
    render: () => (
      <div className="pitch-row pitch-row-between">
        <div className="pitch-col pitch-col-48">
          <Kicker>{E.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-dense">
            {E.h1a}
            <br />
            {E.h1b}
            <Emph delay={0.85}>{E.emph}</Emph>.
          </Rise>
          <Rise i={2} className="pitch-lead">
            {E.lead}
          </Rise>
        </div>
        <SpecPanel i={3} title={E.panelTitle} badge={E.panelBadge} rows={[E.rows[0], [E.rows[1][0], E.rows[1][1], true], E.rows[2], [E.rows[3][0], E.rows[3][1], true], E.rows[4], E.rows[5]]} />
      </div>
    ),
  },

  // 03 · THE GAP (problem, UX-framed)
  {
    id: "gap",
    section: G.section,
    render: () => (
      <div className="pitch-row pitch-row-art">
        <div className="pitch-col pitch-col-54">
          <Kicker>{G.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-art">
            {G.h1a}
            <br />
            {G.h1b}
            <Emph delay={0.7}>{G.emph}</Emph>.
          </Rise>
          <Rise i={2} className="pitch-lead">
            {G.lead}
          </Rise>
        </div>
        <div className="pitch-art pitch-art-right">
          <FrozenPhone tilt={4} i={3} />
        </div>
      </div>
    ),
  },

  // 04 · OUR EDGE (value prop = experience)
  {
    id: "edge",
    section: D.section,
    paper: 2,
    render: () => (
      <div className="pitch-stack">
        <Kicker>{D.kicker}</Kicker>
        <Rise i={1} className="pitch-h1 pitch-h1-art">
          {D.h1a}
          <br />
          <Emph delay={0.85}>{D.emph}</Emph>.
        </Rise>
        <Rise i={2} className="pitch-lead pitch-lead-66">
          {D.lead}
        </Rise>
        <Rise i={3} className="pitch-cells-wrap">
          <div className="pitch-cells">
            {D.cells.map(([n, l]) => (
              <div key={n} className="pitch-cell">
                <div className="pitch-cell-name">{n}</div>
                <div className="pitch-cell-label">{l}</div>
              </div>
            ))}
          </div>
          <Mono className="pitch-cells-note" tone="live">
            {D.live}
          </Mono>
        </Rise>
      </div>
    ),
  },

  // 05 · X AS VEGAS — the distribution wedge, here a Stage-4 promise
  {
    id: "x",
    section: X.section,
    render: () => (
      <div className="pitch-row pitch-row-between pitch-row-gap10">
        <div className="pitch-col pitch-col-52">
          <Kicker>{X.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-art">
            {X.h1a}
            <br />
            {X.h1b}
            <Emph delay={0.7}>{X.emph}</Emph>.
          </Rise>
          <Rise i={2} className="pitch-lead">
            {X.lead}
          </Rise>
          <Rise i={3} className="pitch-pills">
            <Pill tone="verm">{X.pills[0]}</Pill>
            <Pill>{X.pills[1]}</Pill>
            <Pill>{X.pills[2]}</Pill>
          </Rise>
        </div>
        <XBetCard tilt={-1.5} i={4} />
      </div>
    ),
  },

  // 06 · PROOF — the fill projection, checked against the chain
  {
    id: "proof",
    section: P.section,
    paper: 2,
    render: () => (
      <div className="pitch-stack">
        <Kicker>{P.kicker}</Kicker>
        <Rise i={1} className="pitch-h1 pitch-h1-proof">
          {P.h1a}
          <br />
          {P.h1b}
          <Emph delay={0.85}>{P.emph}</Emph>.
        </Rise>
        <Rise i={2} className="pitch-lead pitch-lead-58 pitch-lead-mute">
          {P.lead}
        </Rise>
        <div className="pitch-proof-grid">
          <Rise i={3} className="pitch-proof-left">
            <Mono tone="faint" className="pitch-proof-label">
              {P.leftLabel}
            </Mono>
            <div className="pitch-proof-figure">
              <CountUp to={89} /> <span className="pitch-proof-unit">markets</span>
            </div>
            <div className="pitch-proof-sub">{P.leftSub}</div>
          </Rise>
          <Rise i={4} className="pitch-proof-right">
            <Mono tone="faint" className="pitch-proof-label">
              {P.rightLabel}
            </Mono>
            <div className="pitch-proof-figure">
              <Emph delay={0.7}>
                <span className="green">0</span>
              </Emph>
            </div>
            <div className="pitch-proof-sub">{P.rightSub}</div>
          </Rise>
        </div>
        <Rise i={5} className="pitch-provenance">
          <Mono tone="mute">
            {P.provenance} {shortAddr(PINNED_TESTNET.addresses.marketsCore)}
          </Mono>
          <span className="pitch-faint">·</span>
          <Link href="/status" className="pitch-link-verm" data-cursor="hover">
            {P.status}
          </Link>
        </Rise>
      </div>
    ),
  },

  // 07 · ONBOARDING — what is live, what is next
  {
    id: "onboard",
    section: O.section,
    render: () => (
      <div className="pitch-stack">
        <Kicker>{O.kicker}</Kicker>
        <Rise i={1} className="pitch-h1 pitch-h1-art">
          {O.h1a}
          <br />
          {O.h1b}
          <Emph delay={0.85}>{O.emph}</Emph>.
        </Rise>
        <Rise i={2} className="pitch-lead pitch-lead-64">
          {O.lead}
        </Rise>
        <Rise i={3} className="pitch-cells-wrap">
          <div className="pitch-cells pitch-cells-3">
            {O.cells.map(([n, l, state], index) => (
              <div key={n} className="pitch-cell" data-live={state === "LIVE" ? "true" : "false"}>
                <div className="pitch-cell-head">
                  {index === 2 && <LogoCard s={26} />}
                  <div className="pitch-cell-name">{n}</div>
                </div>
                <div className="pitch-cell-sub">
                  <Mono tone={state === "LIVE" ? "live" : "verm"}>{state}</Mono>
                  <Mono tone="mute">{l}</Mono>
                </div>
              </div>
            ))}
          </div>
        </Rise>
      </div>
    ),
  },

  // 08 · MOBILE (where users are)
  {
    id: "mobile",
    section: M.section,
    paper: 2,
    render: () => (
      <div className="pitch-row pitch-row-between pitch-row-gap10">
        <div className="pitch-col pitch-col-50">
          <Kicker>{M.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-art">
            {M.h1a}
            <br />
            <Emph delay={0.7}>{M.emph}</Emph>.
          </Rise>
          <Rise i={2} className="pitch-lead">
            {M.lead}
          </Rise>
          <Rise i={3} className="pitch-pills">
            <Pill tone="verm">{M.pills[0]}</Pill>
            <Pill>{M.pills[1]}</Pill>
            <Pill>{M.pills[2]}</Pill>
          </Rise>
        </div>
        <PhoneMock tilt={-1.5} i={4} />
      </div>
    ),
  },
];
