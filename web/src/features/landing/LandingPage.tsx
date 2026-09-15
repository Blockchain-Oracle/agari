import Link from "next/link";
import { AgariMark, SectionHead } from "@/components/shell";
import { BRAND } from "@/lib/copy";
import { MARKETS_PATH } from "@/lib/routes";
import { LANDING } from "./copy";
import { LandingDial } from "./LandingDial";
import { LandingLanes } from "./LandingLanes";
import { LandingProof } from "./LandingProof";

const HOW_IT_WORKS_PATH = "/how-it-works";

/**
 * `/` (L-11, D-093): a server-rendered shell in Masayume's tokens with three client islands — the dial, the lanes and
 * the settled Windows. Every figure comes from a read the markets page already makes; the shell adds no data path.
 */
export function LandingPage() {
  const { hero } = LANDING;
  return (
    <div className="lp">
      <section className="page-hero lp-hero">
        <span className="crop tl" />
        <span className="crop tr" />
        <span className="crop bl" />
        <span className="crop br" />
        <div className="container">
          <div className="lp-hero-grid">
            <div className="lp-hero-copy">
              <div className="section-eyebrow lp-eyebrow">{hero.eyebrow}</div>
              <div className="lp-wordmark">
                <span className="lp-wordmark-mark">
                  <AgariMark />
                </span>
                <span className="lp-wordmark-name">{BRAND.name}</span>
              </div>
              <h1 className="lp-title">
                {hero.titleLead} <em>{hero.titleEm}</em>
              </h1>
              <p className="lp-line">{hero.line}</p>
              <div className="lp-ctas">
                <Link href={MARKETS_PATH} className="btn btn-primary lp-cta" data-cursor="hover">
                  {hero.primary}
                </Link>
                <Link href={HOW_IT_WORKS_PATH} className="btn btn-outline lp-cta" data-cursor="hover">
                  {hero.secondary}
                </Link>
              </div>
            </div>
            <div className="lp-hero-dial">
              <LandingDial />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section" aria-label={LANDING.lanes.section.title}>
        <div className="container">
          <SectionHead number={LANDING.lanes.section.index} title={LANDING.lanes.section.title} desc={LANDING.lanes.section.desc} />
          <LandingLanes />
        </div>
      </section>

      <section className="lp-section" aria-label={LANDING.proof.section.title}>
        <div className="container">
          <SectionHead number={LANDING.proof.section.index} title={LANDING.proof.section.title} desc={LANDING.proof.section.desc} />
          <LandingProof />
        </div>
      </section>
    </div>
  );
}
