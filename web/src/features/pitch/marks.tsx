/**
 * Monochrome marks for the folio — ported from `reference/yosuku/app/pitch/page.tsx`
 * L62–75. Colour comes from CSS (`currentColor` / the folio's ink token), never a hex
 * in TSX. The X and card glyphs are the reference's own paths and appear only where a
 * slide truthfully needs them; the chain mark is drawn here rather than reproduced, so
 * no third-party logo is copied into this repo.
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
 * A Solana mark of our own drawing: three slanted bars in a ring, the shape the chain is
 * known by, drawn here in ink rather than copied. Not the network's logo — a stand-in that
 * names it without reproducing a trademark.
 */
export const SolanaMark = ({ s = 19 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 40 40" className="pitch-mark-stroke" aria-hidden>
    <circle cx="20" cy="20" r="17" strokeWidth="2.6" fill="none" />
    <path d="M13 14.6h13.2l-3 3.2H10zM13 18.4h13.2l-3 3.2H10zM13 22.2h13.2l-3 3.2H10z" strokeWidth="0" className="pitch-mark-fill" />
  </svg>
);
