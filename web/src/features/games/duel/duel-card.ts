import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { CARD_H, CARD_MARGIN, CARD_W, closeCard, drawFooter, drawMasthead, drawTracked, ensureFont, fitFontPx, font, openCard, resolveFonts, resolvePalette } from "@/features/share/canvas";
import { SHARE } from "@/features/share/copy";
import { DUEL } from "./copy";

/**
 * The duel's share card — Flicky's `DuelShareCard` (the verdict, the return, the two seats, the three
 * figures) drawn on the app's own 16:9 canvas card, in the Earned Heat grammar: a win is vermilion
 * heat, a loss is drained ash, never green, never red. Nothing on it is a number the chain did not
 * settle: the PnL is payout minus measured cost, the pot is what `finalize` awarded.
 */
export type DuelVerdict = "won" | "lost" | "tied";

export interface DuelCard {
  matchId: string;
  verdict: DuelVerdict;
  /** Return on the cards' cost, in whole percent; null on a free duel or before a cost exists. */
  returnPct: number | null;
  you: string | null;
  opponent: string | null;
  hits: number;
  total: number;
  pnlBase: bigint | null;
  potAwardedBase: bigint | null;
  free: boolean;
  decimals: number;
  symbol: string;
}

const VERDICT_Y = 380;
const RETURN_Y = 560;
const SEATS_Y = 660;
const STATS_Y = 740;

const signed = (base: bigint, decimals: number) => `${base > 0n ? "+" : base < 0n ? "−" : ""}${formatBaseUnits(base < 0n ? -base : base, decimals, { maxDp: 2, minDp: 2 })}`;

export function duelCardId(card: DuelCard): string {
  return card.matchId.replace(/^0x/i, "").slice(0, 6).toUpperCase();
}

export function duelShareUrl(matchId: string): string {
  return `${SHARE.siteUrl}/games/duel/${matchId}`;
}

export async function renderDuelShareCard(card: DuelCard): Promise<Blob> {
  const fonts = resolveFonts();
  const { vermilion, verm, groundTrade, ash, ashDim } = resolvePalette();
  const words = DUEL.result.modal;
  const verdictText = words.verdict[card.verdict].toUpperCase();
  const returnText = card.returnPct === null ? null : `${card.returnPct > 0 ? "+" : ""}${card.returnPct}%`;
  await Promise.all([
    ensureFont(font(800, 180, fonts.display), verdictText),
    ensureFont(font(800, 30, fonts.display), `${SHARE.brand}${SHARE.site}`),
    ensureFont(font(600, 17, fonts.mono)),
    ensureFont(font(500, 24, fonts.mono)),
  ]);

  const { canvas, ctx } = openCard(groundTrade, 0.3, 0.42);
  const won = card.verdict === "won";
  const tone = won ? vermilion : card.verdict === "tied" ? "rgba(255,255,255,0.7)" : ash;
  const width = CARD_W - CARD_MARGIN * 2;
  const centre = CARD_W / 2;

  // The heat behind a win, as Earned Heat draws it: one vermilion glow, nowhere else on the card.
  if (won) {
    const glow = ctx.createRadialGradient(centre, VERDICT_Y - 40, 0, centre, VERDICT_Y - 40, 520);
    glow.addColorStop(0, verm(0.28));
    glow.addColorStop(1, verm(0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }

  drawMasthead(ctx, fonts, SHARE.brand, duelCardId(card), words.recordType);

  ctx.textAlign = "center";
  ctx.font = font(600, 17, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  drawTracked(ctx, words.eyebrow.toUpperCase(), centre, VERDICT_Y - 150, 5, "center");

  ctx.font = font(800, fitFontPx(ctx, verdictText, fonts.display, 800, 180, width, 80), fonts.display);
  ctx.fillStyle = tone;
  ctx.fillText(verdictText, centre, VERDICT_Y);

  if (returnText) {
    ctx.font = font(800, 120, fonts.display);
    ctx.fillStyle = won ? verm(0.9) : card.verdict === "tied" ? "rgba(255,255,255,0.55)" : ashDim;
    ctx.fillText(returnText, centre, RETURN_Y);
  }

  ctx.font = font(500, 24, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(`${card.you ? shortHex(card.you, 6, 4) : "—"}   vs   ${card.opponent ? shortHex(card.opponent, 6, 4) : "—"}`, centre, SEATS_Y);

  const stats: [string, string][] = [
    [words.hits, `${card.hits}/${card.total}`],
    [words.pnl, card.pnlBase === null ? "—" : `${signed(card.pnlBase, card.decimals)} ${card.symbol}`],
    [words.pot, card.free ? words.free : card.potAwardedBase === null ? "—" : `${formatBaseUnits(card.potAwardedBase, card.decimals, { maxDp: 2, minDp: 0 })} ${card.symbol}`],
  ];
  const slot = width / stats.length;
  stats.forEach(([label, value], i) => {
    const x = CARD_MARGIN + slot * i + slot / 2;
    ctx.font = font(600, 17, fonts.mono);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    drawTracked(ctx, label.toUpperCase(), x, STATS_Y - 36, 4, "center");
    ctx.font = font(500, 28, fonts.mono);
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    ctx.fillText(value, x, STATS_Y);
  });
  ctx.textAlign = "left";

  drawFooter(ctx, fonts, card.matchId, words.verifyLine.toUpperCase(), words.footerKind);
  return closeCard(canvas, ctx);
}
