"use client";

import { DEFAULT_LIMITS, DEFAULT_MONEY } from "@agari/core/desk";
import { BASKET_SYMBOLS } from "@agari/core/market";
import { ArrowRight, Ban, Check, CircleDashed, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { RECORD } from "../copy-record";
import { pct, usd } from "../format";
import { ENTRY } from "./copy-entry";
import { SharedDeskPreview } from "./SharedDeskPreview";
import "../desk.css";
import "./entry.css";

/** The desk its owner shares for anyone to read (S21 C7 smoke, the judges' link). */
export const SHARED_DESK_ID = "49f67e4d-dab7-4eb4-9882-2d2a2e80a511";
const EASE = [0.22, 1, 0.36, 1] as const;

function StepCard({ n, title, body, visual, index }: { n: number; title: string; body: string; visual: ReactNode; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li className="en-step" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: reduce ? 0 : 0.15 + index * 0.08, ease: EASE }}>
      <div className="en-step-visual" aria-hidden>{visual}</div>
      <span className="en-step-n">{String(n).padStart(2, "0")}</span>
      <h2 className="en-step-title">{title}</h2>
      <p className="en-step-body">{body}</p>
    </motion.li>
  );
}

const BasketsVisual = (
  <span className="en-baskets">
    {BASKET_SYMBOLS.map((s) => (
      <AssetDisc key={s} asset={s} className="en-basket-disc" />
    ))}
  </span>
);

const LimitsVisual = (
  <span className="en-rules">
    {[ENTRY.limits.perAction(usd(DEFAULT_MONEY.perActionCapE6, 0)), ENTRY.limits.daily(usd(DEFAULT_MONEY.dailyCapE6, 0)), ENTRY.limits.premium(pct(DEFAULT_LIMITS.maxPremiumBps))].map((rule) => (
      <span key={rule} className="en-rule"><ShieldCheck />{rule}</span>
    ))}
  </span>
);

const ChecksVisual = (
  <span className="en-checks">
    <span className="en-check" data-tone="acted"><Check />{RECORD.outcome.would_have_acted}</span>
    <span className="en-check" data-tone="declined"><Ban />{RECORD.outcome.declined}</span>
    <span className="en-check" data-tone="quiet"><CircleDashed />{RECORD.outcome.nothing_to_do}</span>
  </span>
);

/**
 * `/desk` before there is a desk (S22): what a desk does in three pictures (the baskets' own marks, the default
 * limits, the record's verdicts), a live card of the shared desk, and the way into the studio.
 */
export function DeskEntry({ sharedId = SHARED_DESK_ID, preview }: { sharedId?: string | null; preview?: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="dk-page container en-page">
      <section className="en-hero">
        <motion.div className="en-hero-copy" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <span className="dk-eyebrow">{ENTRY.eyebrow}</span>
          <h1 className="en-title">{ENTRY.title}</h1>
          <p className="en-body">{ENTRY.body}</p>
          <div className="en-ctas">
            <Link href="/desk/new" className="dk-control en-cta" data-tone="primary">
              {ENTRY.start}
              <ArrowRight aria-hidden />
            </Link>
            {sharedId && <Link href={`/desk/${sharedId}`} className="dk-control en-cta">{ENTRY.see}</Link>}
          </div>
          <p className="en-note">{ENTRY.noWallet}</p>
        </motion.div>
        {sharedId && (
          <motion.div className="en-hero-preview" initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: reduce ? 0 : 0.1, ease: EASE }}>
            {preview ?? <SharedDeskPreview id={sharedId} />}
          </motion.div>
        )}
      </section>
      <ol className="en-steps" aria-label={ENTRY.stepsAria}>
        {ENTRY.steps.map((s, i) => (
          <StepCard key={s.title} n={i + 1} title={s.title} body={s.body} visual={[BasketsVisual, LimitsVisual, ChecksVisual][i]} index={i} />
        ))}
      </ol>
    </div>
  );
}
