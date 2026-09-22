import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { MARKETS_PATH } from "@/lib/routes";
import { BasketsAndDesk } from "./BasketsAndDesk";
import { HOW_IT_WORKS } from "./copy";
import { Faq } from "./Faq";
import { Mechanics } from "./Mechanics";
import { riseDelay } from "./rise";
import { Asides, SessionLanes } from "./SessionLanes";
import { Settlement } from "./Settlement";
import { Steps } from "./Steps";

/**
 * /how-it-works — ported from `reference/yosuku/app/how-it-works/page.tsx`.
 *
 * The structure is the reference's, section for section: back link, hero, getting
 * started, a worked payout example, key mechanics, the pricing model, fees, the
 * settlement process, the on-chain architecture, FAQ, and the CTA. Every protocol
 * fact under those headings is the agari-events program on Solana, sourced in
 * `content.ts`; nothing about the reference's SVI vault survives, because it is not
 * how this venue prices.
 *
 * Two sections are ours (D-081, D-093): the reference's venue traded crypto, which never
 * closes, so it has nothing to say about a market clock, a lane, a halt or a void. Those
 * go in `SessionLanes` and `Asides`, drawn only with classes the reference's stylesheet
 * already defines, in the places the reading order wants them. Two more, "Baskets" and
 * "How the Desk Decides" (S19, S21), follow the money rules in `BasketsAndDesk`.
 *
 * The reference mounts its own Header and a `router.push` back button; the root
 * shell already carries the chrome, and the back control is a plain link.
 */
export function HowItWorksPage() {
  return (
    <div className="hiw">
      <div className="hiw-glows" aria-hidden>
        <div className="hiw-glow-mint" />
        <div className="hiw-glow-blue" />
      </div>

      <div className="hiw-main">
        <div className="hiw-wrap">
          <Link href={MARKETS_PATH} className="hiw-back" data-cursor="hover">
            <ArrowLeftIcon className="hiw-back-arrow" aria-hidden />
            {HOW_IT_WORKS.back}
          </Link>

          <header className="hiw-hero hiw-rise">
            <h1 className="hiw-title">{HOW_IT_WORKS.title}</h1>
            <p className="hiw-lead">{HOW_IT_WORKS.lead}</p>
          </header>

          <Steps />
          <SessionLanes />
          <Mechanics />
          <Settlement />
          <Asides />
          <BasketsAndDesk />
          <Faq />

          <section className="hiw-card hiw-card-mint hiw-cta hiw-rise" style={riseDelay(0, 700)} aria-label={HOW_IT_WORKS.cta.title}>
            <h2 className="hiw-cta-title">{HOW_IT_WORKS.cta.title}</h2>
            <p className="hiw-cta-body">{HOW_IT_WORKS.cta.body}</p>
            <Link href={MARKETS_PATH} className="hiw-cta-button" data-cursor="hover">
              {HOW_IT_WORKS.cta.action}
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
