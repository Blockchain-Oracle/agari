import { ArrowRightIcon, ChartCandlestickIcon, ChartColumnIcon, MessageSquareIcon, ScrollTextIcon, ShieldCheckIcon, SmartphoneIcon, TrendingUpIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO } from "./copy";
import { Eyebrow, Frame, Kicker, ProofLink, Reveal, Serif } from "./DemoBlocks";
import { DemoTraction } from "./DemoTraction";
import { DemoVideo } from "./DemoVideo";
import { CONTRACT_PROOFS, contractProof, contractProofHref, PROOF_WALLET, PROOFS_READ_ON, TX_PROOFS, txProofHref, txProofLabel } from "./proofs";

/**
 * `/demo` — ported from `reference/yosuku/app/demo/page.tsx`, section for section.
 *
 * The reference is "the walkthrough, in place of a video": the real product, with
 * every claim a transaction anyone can open. That is kept exactly. What changes is
 * every fact: the official video is hosted on YouTube, the traction line is read
 * live from the venue, the screenshots are dated captures of this product, and the
 * proofs are this project's confirmed actions and pinned contracts on the Shannon explorer.
 *
 * The reference draws its own near-black page outside the app shell. Here it sits in
 * the shell like every other route and its ground follows the theme — the user's
 * ruling that a surface which does not flip is a defect, not a style.
 */
const { sections: S } = DEMO;

const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;

function Cta({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={primary ? "demo-cta" : "demo-cta ghost"} data-cursor="hover">
      {children}
    </Link>
  );
}

function TopBar() {
  return (
    <div className="demo-bar">
      <div className="demo-bar-inner">
        <div className="demo-brand">
          {DEMO.bar.brand} <span className="demo-brand-sub">{DEMO.bar.sub}</span>
        </div>
        <div className="demo-bar-links">
          <Link href="/pitch" className="demo-bar-link">
            {DEMO.bar.pitch}
          </Link>
          <Link href="/stats" className="demo-bar-link">
            <ChartColumnIcon className="demo-bar-icon" aria-hidden /> {DEMO.bar.stats}
          </Link>
          <Link href="/markets" className="demo-bar-open" data-cursor="hover">
            {DEMO.bar.open} <ArrowRightIcon className="demo-bar-icon" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="demo-hero">
      <Eyebrow>{DEMO.hero.eyebrow}</Eyebrow>
      <Reveal immediate>
        <h1 className="demo-h1">
          {DEMO.hero.headline}
          <Serif>{DEMO.hero.headlineSerif}</Serif>
        </h1>
      </Reveal>
      <div className="demo-video-label">{DEMO.hero.videoLabel}</div>
      <Reveal immediate>
        <DemoVideo />
      </Reveal>
      <Reveal immediate>
        <p className="demo-lead">{DEMO.hero.lead}</p>
      </Reveal>
      <Reveal immediate className="demo-ctas">
        <Cta href="/markets" primary>
          {DEMO.hero.open} <ArrowRightIcon className="demo-cta-icon" aria-hidden />
        </Cta>
        <Cta href="/stats">
          <ChartColumnIcon className="demo-cta-icon" aria-hidden /> {DEMO.hero.stats}
        </Cta>
        <Cta href="/pitch">{DEMO.hero.pitch}</Cta>
      </Reveal>
      <Reveal immediate>
        <DemoTraction />
      </Reveal>
    </section>
  );
}

export function DemoPage() {
  const book = contractProof("marketsCore");
  const settlement = contractProof("binarySettlement");
  const windows = contractProof("binaryModule");

  return (
    <div className="demo-page">
      <TopBar />
      <Hero />

      {/* 01 — the ritual */}
      <section className="demo-section">
        <Reveal>
          <Kicker icon={<SmartphoneIcon className="demo-kicker-icon" aria-hidden />}>{S.tap.kicker}</Kicker>
          <h2 className="demo-h2">
            {S.tap.headline}
            <Serif>{S.tap.headlineSerif}</Serif>
          </h2>
          <p className="demo-body">{S.tap.body}</p>
          <Link href="/markets" className="demo-inline-link" data-cursor="hover">
            {S.tap.link} <ArrowRightIcon className="demo-cta-icon" aria-hidden />
          </Link>
        </Reveal>
        <Reveal>
          <Frame src="/demo/markets.png" alt={DEMO.frame.markets} />
        </Reveal>
      </section>

      {/* 02 — the reel */}
      <section className="demo-section">
        <Reveal className="demo-order-2">
          <Kicker icon={<ZapIcon className="demo-kicker-icon" aria-hidden />}>{S.reel.kicker}</Kicker>
          <h2 className="demo-h2">
            {S.reel.headline}
            <Serif>{S.reel.headlineSerif}</Serif>
          </h2>
          <p className="demo-body">{S.reel.body}</p>
          <Link href="/reels" className="demo-inline-link" data-cursor="hover">
            {S.reel.link} <ArrowRightIcon className="demo-cta-icon" aria-hidden />
          </Link>
        </Reveal>
        <Reveal className="demo-order-1">
          <Frame src="/demo/reel.png" alt={DEMO.frame.reel} phone />
        </Reveal>
      </section>

      {/* 03 — social by default */}
      <section className="demo-section">
        <Reveal>
          <Kicker icon={<MessageSquareIcon className="demo-kicker-icon" aria-hidden />}>{S.social.kicker}</Kicker>
          <h2 className="demo-h2">
            {S.social.headline}
            <Serif>{S.social.headlineSerif}</Serif>
          </h2>
          <p className="demo-body">{S.social.body}</p>
          <div className="demo-links">
            <Link href="/markets" className="demo-inline-link" data-cursor="hover">
              {S.social.room} <ArrowRightIcon className="demo-cta-icon" aria-hidden />
            </Link>
            <Link href="/markets?sensei=1" className="demo-inline-link" data-cursor="hover">
              {S.social.sensei} <ArrowRightIcon className="demo-cta-icon" aria-hidden />
            </Link>
          </div>
        </Reveal>
        <Reveal>
          <Frame src="/demo/sensei.png" alt={DEMO.frame.sensei} />
        </Reveal>
      </section>

      {/* 04 — the depth */}
      <section className="demo-section single">
        <Reveal>
          <Kicker icon={<TrendingUpIcon className="demo-kicker-icon" aria-hidden />}>{S.depth.kicker}</Kicker>
          <h2 className="demo-h2">
            {S.depth.headline}
            <Serif>{S.depth.headlineSerif}</Serif>
          </h2>
        </Reveal>
        <div className="demo-cards">
          {[
            { icon: <ChartCandlestickIcon className="demo-card-icon" aria-hidden />, card: S.depth.cards.book, proof: book },
            { icon: <ScrollTextIcon className="demo-card-icon" aria-hidden />, card: S.depth.cards.receipts, proof: settlement },
            { icon: <TrendingUpIcon className="demo-card-icon" aria-hidden />, card: S.depth.cards.edge, proof: windows },
          ].map(({ icon, card, proof }) => (
            <Reveal key={card.title}>
              <div className="demo-card">
                {icon}
                <div className="demo-card-title">{card.title}</div>
                <div className="demo-card-body">{card.body}</div>
                <div className="demo-card-proof">
                  <ProofLink href={contractProofHref(proof)} label={`${S.depth.proven} · ${proof.label}`} reference={proof.address} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 05 — proof */}
      <section className="demo-section single">
        <Reveal>
          <Kicker icon={<ShieldCheckIcon className="demo-kicker-icon" aria-hidden />}>{S.verify.kicker}</Kicker>
          <h2 className="demo-h2">
            {S.verify.headline}
            <Serif>{S.verify.headlineSerif}</Serif>
          </h2>
          <p className="demo-body wide">{S.verify.body}</p>
          <p className="demo-proof-note">{S.verify.readOn(shortAddress(PROOF_WALLET), PROOFS_READ_ON)}</p>
        </Reveal>
        <div className="demo-proofs">
          {TX_PROOFS.map((proof) => (
            <Reveal key={proof.hash}>
              <div className="demo-proof-row">
                <ProofLink href={txProofHref(proof)} label={txProofLabel(proof)} reference={proof.hash} />
                <p className="demo-proof-note">{proof.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="demo-proof-note">{S.verify.contracts}</p>
        </Reveal>
        <div className="demo-proofs">
          {CONTRACT_PROOFS.map((proof) => (
            <Reveal key={proof.key}>
              <div className="demo-proof-row">
                <ProofLink href={contractProofHref(proof)} label={proof.label} reference={proof.address} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* footer cta */}
      <section className="demo-close">
        <Reveal>
          <h2 className="demo-close-h2">
            {DEMO.close.headline}
            <Serif>{DEMO.close.headlineSerif}</Serif>
          </h2>
          <div className="demo-close-ctas">
            <Cta href="/markets" primary>
              {DEMO.hero.open} <ArrowRightIcon className="demo-cta-icon" aria-hidden />
            </Cta>
            <Cta href="/stats">
              <ChartColumnIcon className="demo-cta-icon" aria-hidden /> {DEMO.hero.stats}
            </Cta>
            <Cta href="/pitch">{DEMO.hero.pitch}</Cta>
          </div>
          <div className="demo-footer-line">{DEMO.close.footer}</div>
        </Reveal>
      </section>
    </div>
  );
}
