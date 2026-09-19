/**
 * The collateral's mark. The reference also drew a Bitcoin disc and an Ethereum diamond here for the two assets its
 * venue listed; Agari lists stocks, whose marks live in `./asset-marks/`, so those two are gone (2026-09-19).
 * Fills live in `styles/icons.css` — design-literals keeps hex out of TSX.
 */
interface MarkProps {
  className?: string;
}

/**
 * The collateral's mark — the USDC disc (the blue ground, the broken ring, the dollar glyph), which is
 * what the venue's tUSDC is a test print of. No reference precedent: Yosuku's money pill carries a
 * generic coin glyph and its `AddFunds` no token art at all; the owner asked for the token's own logo
 * on the money surfaces (2026-09-04). Drawn as paths so it reads at 14px in the pill.
 */
export function TUsdcMark({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden focusable="false">
      <circle cx="16" cy="16" r="16" className="mark-usdc-disc" />
      <g className="mark-usdc-ring" strokeWidth="1.9" strokeLinecap="round">
        <path d="M12.6 25.4A10 10 0 0 1 12.6 6.6" />
        <path d="M19.4 6.6A10 10 0 0 1 19.4 25.4" />
      </g>
      <g className="mark-usdc-glyph" strokeWidth="2" strokeLinecap="round">
        <path d="M19.4 12.7c-.3-1.6-1.7-2.4-3.4-2.4-2 0-3.4 1-3.4 2.4 0 1.6 1.5 2.1 3.4 2.6 2 .5 3.6 1 3.6 2.8 0 1.5-1.5 2.5-3.6 2.5-1.9 0-3.4-.9-3.6-2.5" />
        <path d="M16 8.2v2.1M16 20.6v2.4" />
      </g>
    </svg>
  );
}
