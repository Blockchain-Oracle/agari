import Link from "next/link";
import { AgariMark, SectionHead } from "@/components/shell";
import { LandingCover } from "./LandingCover";
import { LandingDesk } from "./LandingDesk";
import { BRAND } from "@/lib/copy";
import { MARKETS_PATH } from "@/lib/routes";
import { LANDING } from "./copy";
import { LandingBuiltOn } from "./LandingBuiltOn";
import { LandingDial } from "./LandingDial";
import { LandingFooter } from "./LandingFooter";
import { LandingInstall } from "./LandingInstall";
import { LandingLanes } from "./LandingLanes";
import { LandingProof } from "./LandingProof";
import { LandingSteps } from "./LandingSteps";
import { HOW_IT_WORKS_PATH } from "./paths";
import "./landing.css";

/**
 * `/` (L-11, D-093): a server-rendered shell in Masayume's tokens with four client islands — the dial, the "Built on"
 * band, the lanes and the settled Windows (plus the install page's own stateful button). Every figure comes from a read
 * the markets page already makes, except the band's print mix, which is `/status`'s (S25). Order: hero, built on, three
 * steps, three lanes, cover what you hold (plan Step 6), let a desk hold it (S21), proof, install, honesty footer.
 */
export function LandingPage() {
  const { hero, steps, lanes, cover, desk, proof } = LANDING;
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
            <div className="lp-hero-dial" role="group" aria-label={hero.dialLabel("TSLA")}>
              <LandingDial />
            </div>
          </div>
        </div>
      </section>

      <section className="lp-built-band" aria-label={LANDING.builtOn.label}>
        <div className="container">
          <LandingBuiltOn />
        </div>
      </section>

      <section className="lp-section" aria-label={steps.section.title}>
        <div className="container">
          <SectionHead number={steps.section.index} title={steps.section.title} desc={steps.section.desc} />
          <LandingSteps />
        </div>
      </section>

      <section className="lp-section" aria-label={lanes.section.title}>
        <div className="container">
          <SectionHead number={lanes.section.index} title={lanes.section.title} desc={lanes.section.desc} />
          <LandingLanes />
        </div>
      </section>

      <section className="lp-section" aria-label={cover.section.title}>
        <div className="container">
          <SectionHead number={cover.section.index} title={cover.section.title} desc={cover.section.desc} />
          <LandingCover />
        </div>
      </section>

      <section className="lp-section" aria-label={desk.section.title}>
        <div className="container">
          <SectionHead number={desk.section.index} title={desk.section.title} desc={desk.section.desc} />
          <LandingDesk />
        </div>
      </section>

      <section className="lp-section" aria-label={proof.section.title}>
        <div className="container">
          <SectionHead number={proof.section.index} title={proof.section.title} desc={proof.section.desc} />
          <LandingProof />
        </div>
      </section>

      <section className="lp-section lp-section-install" aria-label={LANDING.install.title}>
        <div className="container">
          <LandingInstall />
        </div>
      </section>

      <div className="container">
        <LandingFooter />
      </div>
    </div>
  );
}
