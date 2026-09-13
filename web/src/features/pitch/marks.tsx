/**
 * Monochrome marks for the folio — ported from `reference/yosuku/app/pitch/page.tsx`
 * L62–75. Colour comes from CSS (`currentColor` / the folio's ink token), never a hex
 * in TSX. The X, Google and card glyphs are the reference's own paths and appear only
 * where a slide truthfully needs them; the Sui mark is replaced by a Somnia mark drawn
 * here — a plain wordmark initial, since no third-party logo was reproduced.
 */

export const LogoX = ({ s = 12 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 1200 1227" className="pitch-mark" aria-hidden>
    <path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z" />
  </svg>
);


export const LogoCard = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s * 0.7} viewBox="0 0 32 22" fill="none" className="pitch-mark-stroke" aria-hidden>
    <rect x="1.2" y="1.2" width="29.6" height="19.6" rx="3.2" strokeWidth="2.2" />
    <rect x="1.2" y="5.6" width="29.6" height="3.6" className="pitch-mark-fill" stroke="none" />
    <rect x="5" y="14" width="9" height="2.6" rx="1.3" className="pitch-mark-fill" stroke="none" />
  </svg>
);

/**
 * A Somnia mark of our own drawing: the chain's initial set in a ring, in ink. Not the
 * network's logo — a stand-in that names it without borrowing what was never seen.
 */
export const SomniaMark = ({ s = 19 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" className="pitch-mark-stroke" aria-hidden>
    <circle cx="20" cy="20" r="17" strokeWidth="2.6" fill="none" />
    <path d="M25.5 14.2c-1.2-1.6-3-2.4-5.4-2.4-3.4 0-5.6 1.7-5.6 4.1 0 2.3 1.6 3.3 5.2 4.1 3.7.8 5.8 2 5.8 4.7 0 2.7-2.4 4.5-6 4.5-2.8 0-4.9-1-6.2-2.9" strokeWidth="2.6" fill="none" strokeLinecap="round" />
  </svg>
);
