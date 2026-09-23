"use client";

import { deskRecordSchema, nameOf, type DeskRecordBody } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { ArrowUpRight, Eye, Radar, Fingerprint, Gavel, Hourglass, Receipt, Search, ShieldCheck, Split, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { DESK, DESK_ADVICE } from "./copy";
import { RECORD } from "./copy-record";
import { CheckIt } from "./CheckIt";
import { DECISION } from "./decision/copy-decision";
import { DecisionHero } from "./decision/DecisionHero";
import { CostShown, LimitsCheck, Options, WhatItSaw } from "./DecisionSaw";
import { ago, pct, pctSigned, stamp, tokensText, usdText } from "./format";
import { TONE } from "./activity/ActivityTimeline";
import type { DecisionWire } from "./protocol";
import "./desk.css";
import "./decision/decision.css";

const D = RECORD.decision;

/** One section on the stepper's rail; the number is passed in, so a page with no cost section reads without a gap. */
function Section({ n, title, icon, children }: { n: number; title: string; icon: ReactNode; children: ReactNode }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.li className="dc-step" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(n, 9) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
      <span className="dc-step-icon" aria-hidden>{icon}</span>
      <section className="dc-step-card" aria-label={title}>
        <h2 className="dc-step-title"><span className="dc-step-n">{String(n).padStart(2, "0")}</span>{title}</h2>
        {children}
      </section>
    </motion.li>
  );
}

function triggerLine(body: DeskRecordBody): string {
  const t = body.wake.trigger;
  const entry = D.trigger[t];
  if (typeof entry === "function") return entry(body.candidate ? nameOf(body.candidate.symbol) : "", "");
  return entry ?? D.routine;
}

function gradeLine(grade: NonNullable<DecisionWire["grade"]>): string {
  if (grade.verdict === "no_real_difference") return D.grade.same;
  if (grade.verdict === "ungradable") return D.grade.ungradable;
  if (grade.verdict === "better") return grade.differenceBps !== null && /acting/i.test(grade.why) ? D.grade.betterActed(pct(grade.differenceBps)) : D.grade.better(pct(grade.differenceBps ?? 0));
  return /waiting/i.test(grade.why) ? D.grade.worseActed(pct(grade.differenceBps ?? 0)) : D.grade.worse(pct(grade.differenceBps ?? 0));
}

export interface DecisionSectionsProps {
  decision: DecisionWire;
  base: string;
  nowSec: number;
  zone: string | null;
  isLive: boolean;
  /** The desk's premium ceiling, when the desk's own view is at hand; shades the price strip. */
  ceilingBps?: number | null;
}

/** One decision, in full (plan §5.9, S22): the verdict hero, then the nine sections as a stepper in the brief's order, Check it under Proof. */
export function DecisionSections({ decision, base, nowSec, zone, isLive, ceilingBps = null }: DecisionSectionsProps) {
  const { record, actions, grade, proof } = decision;
  const parsed = deskRecordSchema.safeParse(record.body);
  const body = parsed.success ? parsed.data : null;
  let count = 0;
  const n = () => ++count;
  const isOwner = decision.viewer === "owner";
  const confidence = body?.timing?.decision?.confidencePercent ?? null;
  return (
    <div className="dk-page container dc-page">
      <header className="dk-hero">
        <span className="dk-eyebrow" data-live={isLive ? "" : undefined}>{isOwner ? (isLive ? DESK.eyebrow.live : DESK.eyebrow.practice) : isLive ? DESK.eyebrow.visitorLive : DESK.eyebrow.visitorPractice}</span>
        <Link href={`${base}/record`} className="dk-link type-caption">{D.back}</Link>
        {!isOwner && <p className="type-caption text-ink-muted">{DESK.visitor}</p>}
      </header>

      <DecisionHero decision={decision} body={body} zone={zone} />

      <ol className="dc-steps" aria-label={DECISION.stepsAria}>
        <Section n={n()} title={D.sections.decision} icon={<Gavel />}>
          <dl className="dc-facts">
            <div className="dc-fact"><dt>{D.what}</dt><dd><span className="dc-verdict-inline" data-tone={TONE[record.outcome]}>{RECORD.outcome[record.outcome]}{record.mode === "practice" ? ` · ${RECORD.list.practiceTag}` : ""}</span></dd></div>
            <div className="dc-fact"><dt>{D.when}</dt><dd>{stamp(record.decidedAtSec, zone)}</dd></div>
            <div className="dc-fact"><dt>{D.mode}</dt><dd>{DESK.modes[record.mode]}</dd></div>
            <div className="dc-fact"><dt>{D.howSure}</dt><dd>{confidence === null ? D.noModel : `${confidence}%`}</dd></div>
          </dl>
          {body?.override && <p className="type-body dk-warn">{D.override(body.override.by, body.override.reason)}</p>}
          {body?.approvalOf && <p className="type-body text-ink-secondary">{D.approvalOf(body.approvalOf.decisionSeq, ago(Math.floor(Date.parse(body.approvalOf.answeredAt) / 1000), nowSec), pctSigned(body.approvalOf.movedBps))}</p>}
        </Section>

        <Section n={n()} title={D.sections.why} icon={<Search />}>
          {body ? (
            <>
              <p className="dc-lead">{body.candidate?.why ?? triggerLine(body)}</p>
              {body.candidate && <p className="dc-chip-line"><Radar aria-hidden />{triggerLine(body)}</p>}
              {body.deferral && <p className="type-caption text-ink-secondary">{D.deferral(body.deferral.decisionSeq)} {body.deferral.stillStanding ? D.deferralStanding : (body.deferral.endedBecause ?? "")}</p>}
            </>
          ) : (
            <p className="type-body text-ink-secondary">{D.routine}</p>
          )}
        </Section>

        <Section n={n()} title={D.sections.saw} icon={<Eye />}>{body ? <WhatItSaw body={body} ceilingBps={ceilingBps} /> : <p className="type-body text-ink-secondary">{D.saw.nothing}</p>}</Section>
        <Section n={n()} title={D.sections.options} icon={<Split />}>{body ? <Options body={body} /> : <p className="type-body text-ink-secondary">{D.options.noModel}</p>}</Section>
        <Section n={n()} title={D.sections.limits} icon={<ShieldCheck />}>{body ? <LimitsCheck body={body} /> : <p className="type-body text-ink-secondary">{D.limits.nothing}</p>}</Section>
        {body?.preview && (
          <Section n={n()} title={D.sections.cost} icon={<Receipt />}><CostShown body={body} /></Section>
        )}

        <Section n={n()} title={D.sections.happened} icon={<Zap />}>
          {record.mode === "practice" ? (
            <>
              <p className="type-body text-ink-secondary">{D.happened.practice}</p>
              {body?.paper && (
                <div className="dc-ledger" aria-label={D.happened.paperAfter}>
                  <span className="dc-subhead">{D.happened.paperAfter}</span>
                  <div className="dc-ledger-row">
                    <span className="dc-leg-usdc" aria-hidden>$</span>
                    <span>{DECISION.cash}</span>
                    <b>{usdText(body.paper.cash)} USDC</b>
                  </div>
                  {Object.entries(body.paper.positions).map(([symbol, raw]) => (
                    <div key={symbol} className="dc-ledger-row">
                      <AssetDisc asset={symbol} className="dc-ledger-disc" />
                      <span>{nameOf(symbol as PreIpoSymbol)}</span>
                      <b>{tokensText(raw)} {symbol}</b>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : actions.length === 0 ? (
            <p className="type-body text-ink-secondary">{D.happened.nothingSent}</p>
          ) : (
            <ul className="dc-actions">
              {actions.map((a) => (
                <li key={a.leg} className="dc-action" data-status={a.status}>
                  <span className="dc-action-head">
                    <b>{a.kind}</b>
                    <span className="dc-badge" data-tone={a.status === "confirmed" ? "ok" : a.failureCode ? "bad" : undefined}>{a.status.replace(/_/g, " ")}</span>
                  </span>
                  {a.actualOut !== null && a.expectedOut !== null && <span className="dk-mono text-ink-secondary">{D.happened.received(a.actualOut, a.expectedOut)}</span>}
                  {a.failureCode && <span className="dk-warn">{D.happened.failed(`${a.failureCode}${a.failureDetail ? `: ${a.failureDetail}` : ""}`)}</span>}
                  {a.signature && <a href={txUrl(a.signature as Signature, "mainnet-beta")} target="_blank" rel="noopener noreferrer" className="dk-link dc-explorer">{D.happened.explorer}</a>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section n={n()} title={D.sections.proof} icon={<Fingerprint />}>
          <p className="type-body text-ink-secondary">{proof.kind === "own" ? D.proof.own : proof.kind === "later" ? D.proof.later(proof.sealingSeq) : proof.kind === "unsealed" ? D.proof.unsealed : D.proof.practice}</p>
          <CheckIt body={record.body} recordHash={record.recordHash} proof={proof} />
        </Section>

        <Section n={n()} title={D.sections.now} icon={<Hourglass />}>
          {grade ? (
            <p className="dc-grade" data-verdict={grade.verdict}>
              {grade.verdict === "better" ? <TrendingUp aria-hidden /> : grade.verdict === "worse" ? <TrendingDown aria-hidden /> : <ArrowUpRight aria-hidden />}
              {gradeLine(grade)}
            </p>
          ) : (
            <p className="type-body text-ink-secondary">{D.grade.notYet}</p>
          )}
        </Section>
      </ol>
      <p className="type-caption text-ink-muted">{DESK_ADVICE}</p>
    </div>
  );
}
