"use client";

import { TRADE_FROM_X, X_LINK_STATUS } from "./copy";
import { Dot, Tick } from "./StepSpine";
import type { XLink } from "./useXStatus";

const XGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="xw-icon--s">
    <path d="M18.9 1.2h3.7l-8 9.1 9.4 12.5h-7.4l-5.8-7.6-6.6 7.6H.5l8.5-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.3H4.4l13.2 17.3Z" />
  </svg>
);

/**
 * Step 3 — link your X account. The reference tweeted a one-time code at a connect worker
 * that is not in the source; the reference's own `api/claim/x/link` route (sign in with X, then
 * a wallet signature over the link message) is what is ported, so no external service is needed.
 */
export function LinkStep({ link, returnTo, enabled }: { link: XLink; returnTo: string; enabled: boolean }) {
  const session = link.status?.session ?? null;
  const binding = link.status?.binding ?? null;
  if (link.loading) return <p className="xt-step-lede" role="status">{X_LINK_STATUS.checking}</p>;
  if (binding && !link.needsLink && !link.walletMismatch) {
    return (
      <div className="xt-done-line">
        <Tick /> {TRADE_FROM_X.linked(binding.handle ?? binding.authorId)}
      </div>
    );
  }
  if (!link.status?.configured) return <p className="xt-step-lede">{X_LINK_STATUS.unavailable}</p>;
  if (!session) {
    return (
      <>
        <p className="xt-step-lede">{TRADE_FROM_X.linkLede}</p>
        <a href={link.startUrl(returnTo)} className={`xt-cta xt-cta-btn xt-cta-btn--x${enabled ? "" : " xc-muted-btn"}`} aria-disabled={!enabled}>
          <XGlyph /> {TRADE_FROM_X.signIn}
        </a>
      </>
    );
  }
  return (
    <>
      <p className="xt-step-lede">
        <Dot /> {`signed in as @${session.handle ?? session.authorId}`}
      </p>
      <button type="button" onClick={() => void link.link()} disabled={!enabled || link.busy !== ""} className="xt-cta xt-cta-btn">
        {link.busy === "link" ? TRADE_FROM_X.linking : TRADE_FROM_X.linkAs(session.handle ?? session.authorId)}
      </button>
    </>
  );
}
