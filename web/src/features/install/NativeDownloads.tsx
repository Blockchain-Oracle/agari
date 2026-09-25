"use client";

import { useState } from "react";
import { ANDROID_RELEASE, INSTALL, IOS_TESTFLIGHT } from "./copy";
import { InstallCta } from "./InstallCta";

const A = INSTALL.android;

/** The checksum on one line, with a copy button — what someone verifying the file actually needs. */
function ShaRow() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(ANDROID_RELEASE.sha256).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="dl-sha">
      <span className="dl-sha-label">{A.shaLabel}</span>
      <code className="dl-sha-value">{ANDROID_RELEASE.sha256}</code>
      <button type="button" className="dl-sha-copy" onClick={copy} aria-live="polite">
        {copied ? A.copied : A.copy}
      </button>
    </div>
  );
}

/**
 * The two native ways in (S26, 09-25). Android: the signed APK from the GitHub release — a QR for the phone on a
 * desktop, the button on the phone itself, the SHA-256 to check it, three steps. iPhone: the public TestFlight
 * invitation opens only after Apple approves the first external beta build; the web app remains installable.
 */
export function NativeDownloads() {
  return (
    <section className="dl-native" aria-label="Download Agari">
      <article className="dl-card dl-card-android">
        <div className="dl-card-head">
          <span className="section-eyebrow">{A.eyebrow}</span>
          <h2>{A.title}</h2>
          <p className="dl-card-meta">{A.size(ANDROID_RELEASE.sizeMb, ANDROID_RELEASE.version)}</p>
        </div>
        <div className="dl-card-body">
          <figure className="dl-qr">
            <img src={ANDROID_RELEASE.qr} alt="QR code that downloads the Agari APK" width={196} height={196} />
            <figcaption>{A.scan}</figcaption>
          </figure>
          <div className="dl-card-main">
            <a className="dl-cta" href={ANDROID_RELEASE.url} download data-cursor="hover">
              {A.cta}
              <svg viewBox="0 0 24 24" aria-hidden="true" className="dl-cta-arrow">
                <path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <ol className="dl-steps">
              {A.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
        <ShaRow />
        <p className="dl-card-foot">
          {A.verify} · <a href={ANDROID_RELEASE.page}>{A.release}</a>
        </p>
      </article>

      <article className="dl-card dl-card-ios">
        <div className="dl-card-head">
          <span className="section-eyebrow">{INSTALL.ios.eyebrow}</span>
          <h2>{INSTALL.ios.title}</h2>
        </div>
        <p className="dl-card-line">{INSTALL.ios.body}</p>
        {IOS_TESTFLIGHT.publicOpen ? (
          <a className="dl-cta" href={IOS_TESTFLIGHT.url} data-cursor="hover">
            {INSTALL.ios.cta}
            <svg viewBox="0 0 24 24" aria-hidden="true" className="dl-cta-arrow">
              <path d="M5 12h14m0 0-5-5m5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ) : (
          <span className="dl-cta is-inert" role="status">{INSTALL.ios.pending}</span>
        )}
        <InstallCta />
      </article>
    </section>
  );
}
