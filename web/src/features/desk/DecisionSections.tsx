"use client";

import { deskRecordSchema, nameOf, type DeskRecordBody } from "@agari/core/desk";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import Link from "next/link";
import type { ReactNode } from "react";
import { DESK, DESK_ADVICE } from "./copy";
import { RECORD } from "./copy-record";
import { CheckIt } from "./CheckIt";
import { CostShown, LimitsCheck, Options, WhatItSaw } from "./DecisionSaw";
import { ago, pct, pctSigned, stamp, tokensText, usdText } from "./format";
import { Outcome } from "./Outcome";
import type { DecisionWire } from "./protocol";
import "./desk.css";

const D = RECORD.decision;

/** Sections number themselves in the order they appear, so a page with no cost section still reads without a gap. */
function counter() {
  let n = 0;
  return function Section({ title, children }: { title: string; children: ReactNode }) {
    n += 1;
    return (
      <section className="dk-panel" aria-label={title}>
        <h2 className="dk-panel-title"><span className="dk-section-n">{String(n).padStart(2, "0")}</span>{title}</h2>
        {children}
      </section>
    );
  };
}

function triggerLine(body: DeskRecordBody): string {
  const t = body.wake.trigger;
  const entry = D.trigger[t];
  if (typeof entry === "function") return entry(body.candidate ? nameOf(body.candidate.symbol) : "", "");
  return entry ?? D.routine;
}

export interface DecisionSectionsProps {
  decision: DecisionWire;
  base: string;
  nowSec: number;
  zone: string | null;
  isLive: boolean;
}

/** One decision, in full (plan §5.9): the nine sections in the brief's order, "plain arithmetic" on the limits check, Check it under Proof. */
export function DecisionSections({ decision, base, nowSec, zone, isLive }: DecisionSectionsProps) {
  const { record, actions, grade, proof } = decision;
  const parsed = deskRecordSchema.safeParse(record.body);
  const body = parsed.success ? parsed.data : null;
  const Section = counter();
  const isOwner = decision.viewer === "owner";
  const confidence = body?.timing?.decision?.confidencePercent ?? null;
  return (
    <div className="dk-page container">
      <header className="dk-hero">
        <span className="dk-eyebrow" data-live={isLive ? "" : undefined}>{isOwner ? (isLive ? DESK.eyebrow.live : DESK.eyebrow.practice) : isLive ? DESK.eyebrow.visitorLive : DESK.eyebrow.visitorPractice}</span>
        <Link href={`${base}/record`} className="dk-link type-caption">{D.back}</Link>
        <div className="dk-title-row">
          <h1 className="dk-title">{RECORD.outcome[record.outcome]}{body?.candidate ? <span className="text-ink-secondary"> · {nameOf(body.candidate.symbol)}</span> : null}</h1>
          <span className="type-caption text-ink-muted">#{record.seq} · {stamp(record.decidedAtSec, zone)}</span>
        </div>
        <p className="type-body text-ink-secondary">{record.summary}</p>
        {!isOwner && <p className="type-caption text-ink-muted">{DESK.visitor}</p>}
      </header>

      <Section title={D.sections.decision}>
        <div className="dk-rows">
          <div className="dk-row"><span>{D.what}</span><Outcome outcome={record.outcome} practice={record.mode === "practice"} /></div>
          <div className="dk-row"><span>{D.when}</span><b>{stamp(record.decidedAtSec, zone)}</b></div>
          <div className="dk-row"><span>{D.mode}</span><b>{DESK.modes[record.mode]}</b></div>
          <div className="dk-row"><span>{D.howSure}</span><b>{confidence === null ? D.noModel : `${confidence}%`}</b></div>
        </div>
        {body?.override && <p className="type-body dk-warn">{D.override(body.override.by, body.override.reason)}</p>}
        {body?.approvalOf && <p className="type-body text-ink-secondary">{D.approvalOf(body.approvalOf.decisionSeq, ago(Math.floor(Date.parse(body.approvalOf.answeredAt) / 1000), nowSec), pctSigned(body.approvalOf.movedBps))}</p>}
      </Section>

      <Section title={D.sections.why}>
        {body ? (
          <>
            <p className="type-body text-ink">{body.candidate?.why ?? triggerLine(body)}</p>
            {body.candidate && <p className="type-caption text-ink-secondary">{triggerLine(body)}</p>}
            {body.deferral && <p className="type-caption text-ink-secondary">{D.deferral(body.deferral.decisionSeq)} {body.deferral.stillStanding ? D.deferralStanding : (body.deferral.endedBecause ?? "")}</p>}
          </>
        ) : (
          <p className="type-body text-ink-secondary">{D.routine}</p>
        )}
      </Section>

      <Section title={D.sections.saw}>{body ? <WhatItSaw body={body} /> : <p className="type-body text-ink-secondary">{D.saw.nothing}</p>}</Section>
      <Section title={D.sections.options}>{body ? <Options body={body} /> : <p className="type-body text-ink-secondary">{D.options.noModel}</p>}</Section>
      <Section title={D.sections.limits}>{body ? <LimitsCheck body={body} /> : <p className="type-body text-ink-secondary">{D.limits.nothing}</p>}</Section>
      {body?.preview && (
        <Section title={D.sections.cost}><CostShown body={body} /></Section>
      )}

      <Section title={D.sections.happened}>
        {record.mode === "practice" ? (
          <>
            <p className="type-body text-ink-secondary">{D.happened.practice}</p>
            {body?.paper && (
              <div className="dk-rows">
                <div className="dk-row"><span>{D.happened.paperAfter}</span><b>{usdText(body.paper.cash)} USDC</b></div>
                {Object.entries(body.paper.positions).map(([symbol, raw]) => (
                  <div key={symbol} className="dk-row"><span>{nameOf(symbol as keyof typeof body.paper.positions & Parameters<typeof nameOf>[0])}</span><b>{tokensText(raw)} {symbol}</b></div>
                ))}
              </div>
            )}
          </>
        ) : actions.length === 0 ? (
          <p className="type-body text-ink-secondary">{D.happened.nothingSent}</p>
        ) : (
          <ul className="dk-rows">
            {actions.map((a) => (
              <li key={a.leg} className="dk-row flex-col items-start">
                <span className="text-ink">{a.kind} <span className="text-ink-secondary">· {a.status.replace(/_/g, " ")}</span></span>
                {a.actualOut !== null && a.expectedOut !== null && <span className="dk-mono">{D.happened.received(a.actualOut, a.expectedOut)}</span>}
                {a.failureCode && <span className="dk-warn">{D.happened.failed(`${a.failureCode}${a.failureDetail ? `: ${a.failureDetail}` : ""}`)}</span>}
                {a.signature && <a href={txUrl(a.signature as Signature, "mainnet-beta")} target="_blank" rel="noopener noreferrer" className="dk-link">{D.happened.explorer}</a>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={D.sections.proof}>
        <p className="type-body text-ink-secondary">{proof.kind === "own" ? D.proof.own : proof.kind === "later" ? D.proof.later(proof.sealingSeq) : proof.kind === "unsealed" ? D.proof.unsealed : D.proof.practice}</p>
        <CheckIt body={record.body} recordHash={record.recordHash} proof={proof} />
      </Section>

      <Section title={D.sections.now}>
        {grade ? (
          <p className="type-body text-ink">
            {grade.verdict === "no_real_difference" ? D.grade.same : grade.verdict === "ungradable" ? D.grade.ungradable : grade.verdict === "better" ? (grade.differenceBps !== null && /acting/i.test(grade.why) ? D.grade.betterActed(pct(grade.differenceBps)) : D.grade.better(pct(grade.differenceBps ?? 0))) : /waiting/i.test(grade.why) ? D.grade.worseActed(pct(grade.differenceBps ?? 0)) : D.grade.worse(pct(grade.differenceBps ?? 0))}
          </p>
        ) : (
          <p className="type-body text-ink-secondary">{D.grade.notYet}</p>
        )}
      </Section>
      <p className="type-caption text-ink-muted">{DESK_ADVICE}</p>
    </div>
  );
}
