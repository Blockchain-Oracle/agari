"use client";

import { nameOf, type DeskRecordBody } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import { Ban, Check, CircleDashed, Hand, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { LogoStack, RadialGauge, StatusDot, type NodeTone } from "@/components/ui/desk-kit";
import { TONE } from "../activity/check-groups";
import { namesIn } from "../activity/activity-model";
import { DESK } from "../copy";
import { RECORD } from "../copy-record";
import { stamp, tokensText, usdText } from "../format";
import type { DecisionWire } from "../protocol";
import { DECISION } from "./copy-decision";

const ICON: Record<NodeTone, ReactNode> = {
  acted: <Check strokeWidth={2.75} />, declined: <Ban />, quiet: <CircleDashed />, asked: <Hand />, stopped: <OctagonAlert />, error: <OctagonAlert />, neutral: <CircleDashed />,
};

/** "$50 of Anthropic" for a buy, "0.4718 Anthropic" for a sell; null when the check had no candidate. */
function amountLine(body: DeskRecordBody | null): { side: "buy" | "sell"; text: string } | null {
  const c = body?.candidate;
  if (!c) return null;
  const name = nameOf(c.symbol);
  return c.side === "buy" ? { side: "buy", text: DECISION.wouldBuy(usdText(c.amountIn), name) } : { side: "sell", text: DECISION.wouldSell(tokensText(c.amountIn), name) };
}

/**
 * The decision's hero (S22): the verdict in its tone with its icon, the companies it was about, the amount, how sure
 * the model was as a gauge, and when, which #, and in which mode.
 */
export function DecisionHero({ decision, body, zone }: { decision: DecisionWire; body: DeskRecordBody | null; zone: string | null }) {
  const { record } = decision;
  const tone = TONE[record.outcome];
  const names: PreIpoSymbol[] = body?.candidate ? [body.candidate.symbol] : namesIn(record.summary);
  const amount = amountLine(body);
  const confidence = body?.timing?.decision?.confidencePercent ?? null;
  const practice = record.mode === "practice";
  return (
    <section className="dc-hero" data-tone={tone} aria-label={RECORD.outcome[record.outcome]}>
      <div className="dc-hero-glow" aria-hidden />
      <div className="dc-hero-main">
        <div className="dc-hero-top">
          <span className="dc-verdict-icon" data-tone={tone} aria-hidden>{ICON[tone]}</span>
          <span className="dc-verdict" data-tone={tone}>{RECORD.outcome[record.outcome]}</span>
          <StatusDot tone={practice ? "practice" : "live"}>{DESK.modes[record.mode]}</StatusDot>
        </div>
        <div className="dc-hero-subject">
          {names.length > 0 && <LogoStack symbols={names} names={names.map((s) => nameOf(s))} size="lg" max={4} />}
          <h1 className="dc-hero-title">
            {amount ? (
              <>
                <span className="dc-hero-side">{DECISION.side[amount.side]}</span> {amount.text}
              </>
            ) : names.length > 0 ? (
              names.map((s) => nameOf(s)).join(" · ")
            ) : (
              RECORD.outcome[record.outcome]
            )}
          </h1>
        </div>
        <p className="dc-hero-summary">{record.summary}</p>
        <p className="dc-hero-meta">
          <span>{DECISION.seq(record.seq)}</span>
          <span aria-hidden>·</span>
          <span>{stamp(record.decidedAtSec, zone)}</span>
        </p>
      </div>
      <div className="dc-hero-side-col">
        {confidence === null ? (
          <RadialGauge value={0} size={96} stroke={8} tone="accent" label={RECORD.decision.noModel}>
            <span className="dc-gauge-text"><b>—</b><small>{DECISION.noModel}</small></span>
          </RadialGauge>
        ) : (
          <RadialGauge value={confidence} size={96} stroke={8} tone={tone === "acted" ? "profit" : tone === "error" || tone === "stopped" ? "loss" : "accent"} label={`${confidence}% ${DECISION.sure}`}>
            <span className="dc-gauge-text"><b>{confidence}%</b><small>{DECISION.sure}</small></span>
          </RadialGauge>
        )}
      </div>
    </section>
  );
}
