import { SparklesIcon } from "lucide-react";
import { STRATEGIES } from "./copy";
import "./strategies.css";

const M = STRATEGIES.memory;

/**
 * The Memory Market (reference "Own what an agent has learned"): sealed playbooks sold as passes.
 * A Seal/Walrus paywall has no equivalent on this deployment, so the gallery keeps its headline and
 * its "more minds soon" capsule and says plainly that playbooks here are open text on the cards.
 */
export function MemoryMarket() {
  return (
    <section className="mt-10 sm:mt-12">
      <div className="strat-rail-title mb-3 tracking-[0.34em] text-vermilion/80">{M.eyebrow}</div>
      <h2 className="strat-memory-h2">
        {M.title[0]}
        <br />
        <span className="text-ink/50">{M.title[1]}</span>
      </h2>
      <p className="type-caption mt-4 max-w-2xl text-ink-secondary">{M.honest}</p>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="strat-capsule-soon">
          <div className="strat-capsule-icon">
            <SparklesIcon aria-hidden="true" />
          </div>
          <div className="strat-choice-title text-ink/70">{M.soonTitle}</div>
          <p className="strat-meta max-w-45 leading-relaxed text-ink/40">{M.soonBody}</p>
        </div>
      </div>
    </section>
  );
}
