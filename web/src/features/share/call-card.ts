import { estPayoutBase } from "@masayume/core/claims";
import { formatCadence } from "@masayume/core/copy";
import type { Hex, Side } from "@masayume/core/types";
import { formatBaseUnits, formatOracleRaw, formatUtc, secToMs } from "@masayume/core/units";
import { ORACLE_SCALE } from "@/features/markets/hero/units";
import { CARD_MARGIN, RECORD_W, closeCard, drawFooter, drawMasthead, drawPerforation, drawSpark, drawTracked, ensureFont, fitFontPx, font, openCard, resolveFonts, resolvePalette } from "./canvas";
import { SHARE } from "./copy";
import { drawStub, encodeQr } from "./stub";

/**
 * "The Call" — the shareable card for one just-placed bet, ported from
 * `reference/yosuku/lib/openBetShareCard.ts` and laid out as the 16:9 banner.
 *
 * HONESTY (hard rules — do not relax):
 *  · This is an OPEN position with NO result. The return is framed conditionally
 *    ("IF IT LANDS"), never as realised.
 *  · The settle time is the Window's real expiry, as an absolute UTC second — never
 *    a "settles in ~Xm" that goes stale the moment it is shared.
 *  · Every number is what the wallet actually staked, and the return is net of the
 *    settlement fee when the fee is known.
 *  · A boost carries the reference's knock-out caveat, exactly as it prints it; a
 *    plain call prints nothing rather than "1×".
 */
export interface CallCard {
  /** A boost: the multiple and the reserve's claim, repaid before the return; null for a plain call. */
  leverage: { leverageBps: number; frontedBase: bigint } | null;
  asset: string;
  side: Side;
  intervalSec: number;
  /** The opening print on the oracle scale; null when the call was placed before it landed. */
  lineRaw: bigint | null;
  stakeBase: bigint;
  contractsRaw: bigint;
  decimals: number;
  symbol: string;
  /** Settlement fee in basis points; null when unread, in which case the return is gross and says so. */
  feeBps: number | null;
  expirySec: number;
  txHash: Hex;
  placedAtMs: number;
}

/** Baselines down the record panel. */
const EYEBROW_Y = 272;
const HERO_Y = 386;
const WINS_IF_Y = 434;
const STAKE_LABEL_Y = 520;
const WAGER_Y = 612;
const FEE_NOTE_Y = 656;
const SETTLES_Y = 728;

const fmt = (value: bigint, decimals: number) => formatBaseUnits(value, decimals);
const usd0 = (raw: bigint) => `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`;

/** What a win returns — one unit per contract less the settlement fee when it is known, less the reserve's claim on a boost. */
export function callWinBase(card: CallCard): bigint {
  const net = card.feeBps === null ? card.contractsRaw : estPayoutBase(card.contractsRaw, "win", card.feeBps);
  if (!card.leverage) return net;
  return net > card.leverage.frontedBase ? net - card.leverage.frontedBase : 0n;
}

export function callMultiple(card: CallCard): number {
  return card.leverage ? Math.round(card.leverage.leverageBps / 1_000) / 10 : 1;
}

/** "BTC OVER $64,316" / "BTC UNDER $64,316" / "BTC VS THE OPENING PRINT". */
export function callBandLabel(card: CallCard): string {
  if (card.lineRaw === null) return SHARE.call.noLine(card.asset);
  return card.side === "up" ? SHARE.call.over(card.asset, usd0(card.lineRaw)) : SHARE.call.under(card.asset, usd0(card.lineRaw));
}

export function callDirLabel(card: CallCard): string {
  return card.side === "up" ? SHARE.call.up : SHARE.call.down;
}

/** Folio / filename id: first 6 hex of the entry tx, uppercased. */
export function shortCallId(card: CallCard): string {
  return card.txHash.replace(/^0x/i, "").slice(0, 6).toUpperCase();
}

const shortHash = (hash: string): string => (hash.length > 14 ? `${hash.slice(0, 14)}…` : hash);

/** Honest pre-filled post text — real staked numbers only, framed as a live call. */
export function buildCallTweetText(card: CallCard): string {
  return SHARE.call.tweet(callBandLabel(card).toLowerCase(), formatCadence(card.intervalSec), fmt(card.stakeBase, card.decimals), fmt(callWinBase(card), card.decimals), card.symbol, formatUtc(secToMs(card.expirySec)), callMultiple(card));
}

export async function renderCallShareCard(card: CallCard): Promise<Blob> {
  const fonts = resolveFonts();
  const palette = resolvePalette();
  const { vermilion, verm, groundCall } = palette;
  const band = callBandLabel(card);
  const stakeText = fmt(card.stakeBase, card.decimals);
  const winText = fmt(callWinBase(card), card.decimals);
  const arrow = "  →  ";
  const wager = `${stakeText}${arrow}${winText}`;
  const qr = encodeQr(SHARE.siteUrl);

  await Promise.all([
    ensureFont(font(800, 112, fonts.display), band),
    ensureFont(font(800, 88, fonts.display), wager),
    ensureFont(font(800, 30, fonts.display), `${SHARE.brand}${SHARE.site}`),
    ensureFont(font(600, 24, fonts.mono)),
    ensureFont(font(500, 20, fonts.mono)),
    ensureFont(font(400, 19, fonts.mono)),
  ]);

  // Flat near-black; the heat lives only on the spark, the direction and the return.
  const { canvas, ctx } = openCard(groundCall, 0.3, 0.46);
  drawMasthead(ctx, fonts, SHARE.brand, shortCallId(card), SHARE.call.recordType);
  drawSpark(ctx, verm(0.6));

  // direction eyebrow
  ctx.font = font(600, 24, fonts.mono);
  ctx.fillStyle = vermilion;
  drawTracked(ctx, callDirLabel(card), CARD_MARGIN, EYEBROW_Y, 4, "left");

  // hero: the call
  const heroPx = fitFontPx(ctx, band, fonts.display, 800, 112, RECORD_W, 48);
  ctx.font = font(800, heroPx, fonts.display);
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.textAlign = "left";
  ctx.fillText(band, CARD_MARGIN, HERO_Y);

  ctx.font = font(400, 20, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(SHARE.call.winsIf(card.asset, card.side), CARD_MARGIN, WINS_IF_Y);

  // wager: stake → return (the return carries the vermilion)
  ctx.font = font(600, 15, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  drawTracked(ctx, SHARE.call.stakeLine, CARD_MARGIN, STAKE_LABEL_Y, 4, "left");

  const wagerPx = fitFontPx(ctx, wager, fonts.display, 800, 88, RECORD_W, 40);
  ctx.font = font(800, wagerPx, fonts.display);
  let wx = CARD_MARGIN;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(stakeText, wx, WAGER_Y);
  wx += ctx.measureText(stakeText).width;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillText(arrow, wx, WAGER_Y);
  wx += ctx.measureText(arrow).width;
  ctx.save();
  ctx.shadowColor = verm(0.5);
  ctx.shadowBlur = 60;
  ctx.fillStyle = vermilion;
  ctx.fillText(winText, wx, WAGER_Y);
  ctx.restore();
  ctx.fillStyle = vermilion;
  ctx.fillText(winText, wx, WAGER_Y);

  ctx.font = font(500, 17, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  const feeNote = card.feeBps === null ? card.symbol : `${card.symbol} · ${SHARE.call.afterFee.toUpperCase()}`;
  drawTracked(ctx, card.leverage ? `${SHARE.call.leverageLine(callMultiple(card))} · ${feeNote}` : feeNote, CARD_MARGIN, FEE_NOTE_Y, 5, "left");

  // settle line (real expiry, absolute UTC)
  const settles = SHARE.call.settlesLine(formatUtc(secToMs(card.expirySec)));
  ctx.font = font(400, fitFontPx(ctx, settles, fonts.mono, 400, 19, RECORD_W, 12), fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(settles, CARD_MARGIN, SETTLES_Y);

  drawPerforation(ctx);
  drawStub(ctx, fonts, palette, qr);
  drawFooter(ctx, fonts, SHARE.call.tx(shortHash(card.txHash)), SHARE.verifyOn, SHARE.call.footerKind);
  return closeCard(canvas, ctx);
}
