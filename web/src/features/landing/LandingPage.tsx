import Link from "next/link";
import Image from "next/image";
import { AgariMark, SectionHead } from "@/components/shell";
import { LandingCover } from "./LandingCover";
import { LandingDesk } from "./LandingDesk";
import { BRAND } from "@/lib/copy";
import { DOCS_URL } from "@/lib/docs-url";
import { MARKETS_PATH } from "@/lib/routes";
import { LANDING } from "./copy";
import { LandingBuiltOn } from "./LandingBuiltOn";
import { LandingFooter } from "./LandingFooter";
import { LandingInstall } from "./LandingInstall";
import { LandingHeroShowcase } from "./LandingHeroShowcase";
import { LandingLanes } from "./LandingLanes";
import { LandingProof } from "./LandingProof";
import { LandingSteps } from "./LandingSteps";
import { HOW_IT_WORKS_PATH } from "./paths";
import "./landing.css";
import "./landing-hero.css";

/**
 * The landing hero is an editorial entry to the real basket and proof surfaces. Its product previews are rendered
 * components, while the rest of the page keeps its existing live reads and guides.
 */
export function LandingPage() {
  const { hero, steps, lanes, cover, desk, proof } = LANDING;
  return (
    <div className="lp">
      <section className="page-hero lp-hero">
        <span className="lp-hero-jp" lang="ja" aria-hidden="true" data-text="上がり">上がり</span>
        <span className="lp-hero-vertical" aria-hidden="true" />
        <div className="container lp-hero-container">
          <div className="lp-hero-grid">
            <div className="lp-hero-brand">
              <p className="lp-eyebrow">
                <Image src="/brand/solana-logomark.svg" alt="" width={101} height={88} className="lp-solana-mark" />
                {hero.eyebrow}
              </p>
              <div className="lp-wordmark">
                <span className="lp-wordmark-mark"><AgariMark /></span>
                <span className="lp-wordmark-name">{BRAND.name}</span>
              </div>
            </div>
            <div className="lp-hero-copy">
              <h1 className="lp-title">
                <span>{hero.titleLead}</span>
                <span>{hero.titleEm}</span>
              </h1>
              <span className="lp-title-rule" aria-hidden="true" />
              <p className="lp-hero-paths">{hero.paths}</p>
              <p className="lp-line">{hero.line}</p>
              <div className="lp-ctas">
                <Link href={MARKETS_PATH} className="btn btn-primary lp-cta" data-cursor="hover">
                  {hero.primary}
                </Link>
                <Link href={HOW_IT_WORKS_PATH} className="btn btn-outline lp-cta" data-cursor="hover">
                  {hero.secondary}
                </Link>
                <a href={DOCS_URL} className="lp-docs" data-cursor="hover">
                  {hero.docs}
                </a>
              </div>
            </div>
            <LandingHeroShowcase />
          </div>
          <div className="lp-hero-folio">
            <span>{hero.folioLeft}</span>
            <span>{hero.folioRight}</span>
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
