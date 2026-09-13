"use client";

import { PINNED_TESTNET } from "@masayume/markets";
import Link from "next/link";
import MasayumeMark from "@/components/shell/MasayumeMark";
import { PITCH } from "./copy";
import { PhoneMock } from "./mocks";
import { CountUp, Emph, Kicker, Mono, PhaseCard, Rise, SpecPanel, StatCard } from "./primitives";
import type { Slide } from "./types";
import type { VenueUsage } from "./useVenueUsage";

/**
 * Slides 09–15 — ported from `reference/yosuku/app/pitch/page.tsx` L471–634. The
 * "real usage" slide is the one that reads the venue live (`useVenueUsage`); the deck
 * threads the reading in so the slide never fetches on its own each time it mounts.
 */

const shortAddr = (a: string) => a.slice(0, 10);

const A = PITCH.agents;
const U = PITCH.demand;
const R = PITCH.revenue;
const W = PITCH.whySomnia;
const T = PITCH.team;
const RM = PITCH.roadmap;
const CL = PITCH.close;

function UsageStat({ usage, kind, i }: { usage: VenueUsage; kind: "wallets" | "calls"; i: number }) {
  const label = kind === "wallets" ? U.wallets : U.calls;
  const source = kind === "wallets" ? U.walletsSource : U.callsSource;
  if (usage.state === "reading") return <StatCard i={i} value={<span className="pitch-stat-holding">{U.reading}</span>} label={label} source={source} />;
  if (usage.state === "unavailable") return <StatCard i={i} value={<span className="pitch-stat-holding">{U.unavailable}</span>} label={label} source={source} />;
  const n = kind === "wallets" ? usage.rankedTraders : usage.closedCalls;
  return <StatCard i={i} value={<CountUp to={n} />} label={label} source={usage.complete ? source : `${source} · ${U.partial}`} hl={kind === "calls"} />;
}

export function slidesB(usage: VenueUsage): Slide[] {
  return [
    // 09 · AI AGENTS — Sensei reads; it never trades
    {
      id: "agents",
      section: A.section,
      render: () => (
        <div className="pitch-row pitch-row-between">
          <div className="pitch-col pitch-col-50">
            <Kicker>{A.kicker}</Kicker>
            <Rise i={1} className="pitch-h1 pitch-h1-dense">
              {A.h1a}
              <br />
              {A.h1b}
              <Emph delay={0.85}>{A.emph}</Emph>.
            </Rise>
            <Rise i={2} className="pitch-lead">
              {A.lead}
            </Rise>
          </div>
          <SpecPanel i={3} title={A.panelTitle} badge={A.panelBadge} rows={[A.rows[0], A.rows[1], [A.rows[2][0], A.rows[2][1], true], [A.rows[3][0], A.rows[3][1], true], A.rows[4]]} />
        </div>
      ),
    },

    // 10 · REAL USAGE (demand) — read live from the venue
    {
      id: "demand",
      section: U.section,
      paper: 2,
      render: () => (
        <div className="pitch-stack">
          <Kicker>{U.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-dense">
            {U.h1a}
            <br />
            {U.h1b}
            <Emph delay={0.85}>{U.emph}</Emph>.
          </Rise>
          <div className="pitch-stats">
            <UsageStat usage={usage} kind="wallets" i={2} />
            <UsageStat usage={usage} kind="calls" i={3} />
            <StatCard i={4} value={U.exact} label={U.exactLabel} source={U.exactSource} />
          </div>
          <Rise i={5} className="pitch-body-note">
            {U.lead}
          </Rise>
        </div>
      ),
    },

    // 11 · LONG-TERM REVENUE (the model) — no invented rate
    {
      id: "revenue",
      section: R.section,
      render: () => (
        <div className="pitch-stack">
          <Kicker>{R.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-dense">
            {R.h1a}
            <Emph delay={0.85}>{R.emph}</Emph>.
          </Rise>
          <div className="pitch-panels">
            <SpecPanel i={2} title={R.modelTitle} rows={[R.modelRows[0], R.modelRows[1], [R.modelRows[2][0], R.modelRows[2][1], true], R.modelRows[3]]} />
            <SpecPanel i={3} title={R.seamTitle} badge={R.seamBadge} badgeTone="verm" rows={[R.seamRows[0], R.seamRows[1], [R.seamRows[2][0], R.seamRows[2][1], true], R.seamRows[3]]} />
          </div>
          <Rise i={4} className="pitch-body-note pitch-body-note-86">
            {R.lead}
          </Rise>
        </div>
      ),
    },

    // 12 · TECHNICAL + WHY SOMNIA
    {
      id: "why-somnia",
      section: W.section,
      paper: 2,
      render: () => (
        <div className="pitch-row pitch-row-between">
          <div className="pitch-col pitch-col-44">
            <Kicker>{W.kicker}</Kicker>
            <Rise i={1} className="pitch-h1 pitch-h1-art">
              {W.h1a}
              <br />
              {W.h1b}
              <Emph delay={0.7}>{W.emph}</Emph>.
            </Rise>
            <Rise i={2} className="pitch-lead">
              {W.lead}
            </Rise>
          </div>
          <SpecPanel
            i={3}
            wide
            title={W.panelTitle}
            badge={W.panelBadge}
            rows={[
              [W.labels.venue, `${W.labels.venueValue} · ${shortAddr(PINNED_TESTNET.addresses.marketsCore)}`, true],
              [W.labels.settlement, shortAddr(PINNED_TESTNET.addresses.binarySettlement), true],
              [W.labels.oracle, shortAddr(PINNED_TESTNET.addresses.oracleHub)],
              [W.labels.tokens, W.labels.tokensValue],
              [W.labels.indexer, W.labels.indexerValue],
              [W.labels.gas, W.labels.gasValue],
            ]}
          />
        </div>
      ),
    },

    // 13 · TEAM — one builder, no invented names
    {
      id: "team",
      section: T.section,
      paper: 2,
      render: () => (
        <div className="pitch-stack">
          <Kicker>{T.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-dense">
            {T.h1a}
            <br />
            {T.h1b}
            <Emph delay={0.85}>{T.emph}</Emph>.
          </Rise>
          <Rise i={2} className="pitch-team">
            <span className="pitch-team-avatar">
              <MasayumeMark className="pitch-team-mark" />
            </span>
            <span>
              <div className="pitch-team-name">
                {T.name} <span className="pitch-team-role">· {T.role}</span>
              </div>
              <div className="pitch-team-body">{T.body}</div>
            </span>
          </Rise>
        </div>
      ),
    },

    // 14 · ROADMAP
    {
      id: "roadmap",
      section: RM.section,
      render: () => (
        <div className="pitch-stack">
          <Kicker>{RM.kicker}</Kicker>
          <Rise i={1} className="pitch-h1 pitch-h1-art">
            {RM.h1a}
            <Emph delay={0.8}>{RM.emph}</Emph>.
          </Rise>
          <div className="pitch-phases">
            <PhaseCard i={2} tone="live" tag={RM.now.tag} title={RM.now.title} body={RM.now.body} />
            <PhaseCard i={3} tag={RM.next.tag} title={RM.next.title} body={RM.next.body} />
            <PhaseCard i={4} tag={RM.then.tag} title={RM.then.title} body={RM.then.body} />
          </div>
          <Rise i={5} className="pitch-roadmap-foot">
            <Mono tone="live">{RM.foot}</Mono>
          </Rise>
        </div>
      ),
    },

    // 15 · CLOSE
    {
      id: "close",
      section: CL.section,
      paper: 2,
      render: () => (
        <div className="pitch-row pitch-row-art">
          <div className="pitch-col pitch-col-56">
            <Kicker>{CL.kicker}</Kicker>
            <Rise i={1} className="pitch-h1 pitch-h1-close">
              {CL.h1a}
              <br />
              <Emph delay={0.7}>{CL.emph}</Emph>.
            </Rise>
            <Rise i={2} className="pitch-lead">
              {CL.lead}
            </Rise>
            <Rise i={3} className="pitch-ask">
              {CL.ask}{" "}
              <Link href="/leaderboard" className="pitch-link-verm" data-cursor="hover">
                /leaderboard
              </Link>{" "}
              ·{" "}
              <Link href="/status" className="pitch-link-verm" data-cursor="hover">
                /status
              </Link>
            </Rise>
          </div>
          <div className="pitch-art pitch-art-right pitch-art-close">
            <PhoneMock won tilt={2} i={4} />
          </div>
        </div>
      ),
    },
  ];
}
