/** The share cards' words — ported from the reference's two card renderers and `BetPlacedCard.tsx`. */

/**
 * The brand as the owner gave it (2026-09-02): the public home and the X handle. The handle is the one
 * account people tag to bet from X, so it follows the deployment (`NEXT_PUBLIC_X_HANDLE`, inlined at
 * build) — the owner's account is not yet the name the placeholder assumed (2026-09-04).
 */
const BRAND = {
  brand: "MASAYUME",
  site: "masayume.app",
  siteUrl: "https://masayume.app",
  handle: process.env.NEXT_PUBLIC_X_HANDLE?.trim() || "@masayume_app",
} as const;

const signOff = `${BRAND.site} via ${BRAND.handle}`;

export const SHARE = {
  ...BRAND,
  network: "SOMNIA TESTNET",
  verifyOn: "VERIFY ON SHANNON EXPLORER",
  scan: "SCAN TO MAKE YOUR CALL",
  shareCall: "Share this call",
  shareCard: "Share card",
  rendering: "Rendering…",
  savedAttach: "Card saved. Attach it to your post on X",
  renderFailed: "Could not render the share card",
  call: {
    recordType: "THE CALL · SOMNIA TESTNET",
    up: "▲ CALLING UP",
    down: "▼ CALLING DOWN",
    placed: "Call placed",
    over: (asset: string, line: string) => `${asset} OVER ${line}`,
    under: (asset: string, line: string) => `${asset} UNDER ${line}`,
    noLine: (asset: string) => `${asset} VS THE OPENING PRINT`,
    winsIf: (asset: string, side: "up" | "down") => `Wins if ${asset} closes ${side === "up" ? "at or above" : "below"} the line.`,
    youStake: "You stake",
    winIfLands: "Win if it lands",
    afterFee: "after the settlement fee",
    /** The reference's caveat on a boosted call (`BetPlacedCard.tsx` L123–127) and its PNG line (`openBetShareCard.ts` L360). */
    leverageNote: (x: number) => `✦ ${x}× leverage. It can knock out before close.`,
    leverageLine: (x: number) => `${x}× LEVERAGE · CAN KNOCK OUT BEFORE THE CLOSE`,
    settlesIn: "Settles in",
    settling: "Settling…",
    verify: "verify on Shannon explorer ↗",
    portfolio: "Portfolio",
    another: "Place another",
    stakeLine: "STAKE  →  RETURN IF IT LANDS",
    settlesLine: (utc: string) => `SETTLES ${utc} · ORACLE-SETTLED AT THE CLOSE`,
    footerKind: "MASAYUME · LIVE CALL",
    tx: (short: string) => `TX ${short}`,
    /** The pre-filled post: real staked numbers only, framed as a live call. */
    /** The reference's text carries the multiple — `My call: ${band} (2×)` (`openBetShareCard.ts` L97–99). */
    tweet: (band: string, cadence: string, stake: string, win: string, symbol: string, utc: string, multiple = 1) =>
      `My call: ${band} (${cadence} Window${multiple > 1 ? `, ${multiple}×` : ""}). Staked ${stake} to win ${win} ${symbol}, oracle-settles ${utc} on Somnia testnet. Will it land? ${signOff}`,
  },
  trade: {
    settlement: "SETTLEMENT RECORD",
    voidRecord: "VOID RECORD",
    closeOut: "CLOSE-OUT RECORD",
    realized: (symbol: string) => `REALIZED P&L · ${symbol}`,
    paidOut: (symbol: string) => `PAID OUT · ${symbol}`,
    oracleSettled: (print: string, utc: string) => `ORACLE-SETTLED ${print} AT ${utc}`,
    settledAt: (utc: string) => `SETTLED · ${utc}`,
    voided: (utc: string) => `VOIDED · BOTH SIDES PAID 0.5 · ${utc}`,
    closedEarly: (utc: string) => `CLOSED ON THE BOOK BEFORE EXPIRY · ${utc}`,
    kind: { settled: "ORACLE-SETTLED", voided: "VOIDED", closed: "CLOSED EARLY" },
    entry: (short: string) => `ENTRY ${short}`,
    settlementTx: (short: string) => `SETTLEMENT ${short}`,
    noTx: "PROOF ON THE RECEIPT",
    tweet: (pnl: string, symbol: string, asset: string, band: string, how: string, stake: string, payout: string) =>
      `${pnl} ${symbol} on ${asset} ${band}: ${how}. ${stake} → ${payout} ${symbol} (Somnia testnet). ${signOff}`,
  },
} as const;
