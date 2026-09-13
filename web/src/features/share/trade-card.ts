import { formatCadence } from "@masayume/core/copy";
import type { Hex, Side } from "@masayume/core/types";
import { formatBaseUnits, formatOracleRaw, formatUtc, secToMs } from "@masayume/core/units";
import { ORACLE_SCALE } from "@/features/markets/hero/units";
import { CARD_H, CARD_MARGIN, CARD_W, RECORD_RIGHT, RECORD_W, closeCard, drawFooter, drawMasthead, drawPerforation, drawTracked, ensureFont, fitFontPx, font, openCard, resolveFonts, resolvePalette } from "./canvas";
import { SHARE } from "./copy";
import { drawStub, encodeQr } from "./stub";

/**
 * "Earned Heat" — the shareable card for one settled Window, ported from
 * `reference/yosuku/lib/shareCard.ts` and laid out as the 16:9 banner.
 *
 * The realised P&L is the giant focal number: a win is living vermilion heat, a loss
 * is drained ash — never green, never red. ONE-SPARK rule: vermilion appears only
 * on a win, and only in the P&L — the stub stays neutral for that reason.
 *
 * HONESTY (hard rules — do not relax):
 *  · The oracle's print is drawn ONLY when the closing print is on record, at the
 *    Window's real expiry second; otherwise the line says "SETTLED" and the claim
 *    time, never a guessed print.
 *  · A void says both sides paid 0.5. A close-out says it closed on the book before
 *    expiry and never claims an oracle settlement.
 *  · With no entry cost on record the hero is the payout, labelled PAID OUT, never
 *    a P&L computed from a guessed stake.
 */
export type TradeOutcome = "win" | "loss" | "void" | "closed";

export interface TradeCard {
  asset: string;
  intervalSec: number;
  sides: Side[];
  outcome: TradeOutcome;
  lineRaw: bigint | null;
  closeRaw: bigint | null;
  /** What stayed in; null when no entry cost is on record. */
  stakeBase: bigint | null;
  payoutBase: bigint;
  pnlBase: bigint;
  decimals: number;
  symbol: string;
  expirySec: number;
  settledAtMs: number;
  entryTxHash: Hex | null;
  settlementTxHash: Hex | null;
}

/** Baselines down the record panel, and where the heat sits behind the hero. */
const LABEL_Y = 330;
const HERO_Y = 520;
const SUB_Y = 606;
const KIND_Y = 654;
const HEAT_CX = (CARD_MARGIN + RECORD_RIGHT) / 2;
const HEAT_CY = 470;

const fmt = (value: bigint, decimals: number) => formatBaseUnits(value, decimals);
const usd0 = (raw: bigint) => `$${formatOracleRaw(raw, ORACLE_SCALE, 0)}`;
const usd2 = (raw: bigint) => `$${formatOracleRaw(raw, ORACLE_SCALE, 2)}`;
const shortHash = (hash: string): string => (hash.length > 12 ? `${hash.slice(0, 12)}…` : hash);

/** "UP vs $64,316" / "UP + DOWN vs $64,316" / "UP vs the opening print". */
export function tradeBandLabel(card: TradeCard): string {
  const sides = card.sides.map((side) => side.toUpperCase()).join(" + ") || "—";
  return card.lineRaw === null ? `${sides} vs the opening print` : `${sides} vs ${usd0(card.lineRaw)}`;
}

/** Folio / filename id: first 6 hex of the entry tx when known, else of the settlement tx. */
export function shortTradeId(card: TradeCard): string {
  const hash = card.entryTxHash ?? card.settlementTxHash ?? "0x000000";
  return hash.replace(/^0x/i, "").slice(0, 6).toUpperCase();
}

interface TradeLook {
  won: boolean;
  recordType: string;
  kindLine: string;
  footerKind: string;
}

function tradeLook(card: TradeCard): TradeLook {
  const claimed = formatUtc(card.settledAtMs, { withDate: true });
  if (card.outcome === "void") return { won: false, recordType: SHARE.trade.voidRecord, kindLine: SHARE.trade.voided(claimed), footerKind: SHARE.trade.kind.voided };
  if (card.outcome === "closed") return { won: card.pnlBase > 0n, recordType: SHARE.trade.closeOut, kindLine: SHARE.trade.closedEarly(claimed), footerKind: SHARE.trade.kind.closed };
  const kindLine = card.closeRaw !== null ? SHARE.trade.oracleSettled(usd2(card.closeRaw), formatUtc(secToMs(card.expirySec), { withDate: true })) : SHARE.trade.settledAt(claimed);
  return { won: card.pnlBase > 0n, recordType: SHARE.trade.settlement, kindLine, footerKind: SHARE.trade.kind.settled };
}

/** Honest pre-filled post text from real fields only. */
export function buildTradeTweetText(card: TradeCard): string {
  const look = tradeLook(card);
  const pnl = card.stakeBase === null ? fmt(card.payoutBase, card.decimals) : formatBaseUnits(card.pnlBase, card.decimals, { signed: true });
  return SHARE.trade.tweet(pnl, card.symbol, card.asset, tradeBandLabel(card).toLowerCase(), look.kindLine.toLowerCase(), card.stakeBase === null ? "—" : fmt(card.stakeBase, card.decimals), fmt(card.payoutBase, card.decimals));
}

export async function renderTradeShareCard(card: TradeCard): Promise<Blob> {
  const fonts = resolveFonts();
  const palette = resolvePalette();
  const { vermilion, verm, groundTrade, ash, ashDim } = palette;
  const look = tradeLook(card);
  const heroText = card.stakeBase === null ? fmt(card.payoutBase, card.decimals) : formatBaseUnits(card.pnlBase, card.decimals, { signed: true }).replace(/^-/, "−");
  const heroLabel = card.stakeBase === null ? SHARE.trade.paidOut(card.symbol) : SHARE.trade.realized(card.symbol);
  const subLine = `${card.asset} · ${tradeBandLabel(card)} · ${formatCadence(card.intervalSec)} · ${card.stakeBase === null ? "—" : fmt(card.stakeBase, card.decimals)} → ${fmt(card.payoutBase, card.decimals)} ${card.symbol}`;
  const qr = encodeQr(SHARE.siteUrl);

  await Promise.all([
    ensureFont(font(800, 200, fonts.display), heroText),
    ensureFont(font(800, 30, fonts.display), `${SHARE.brand}${SHARE.site}`),
    ensureFont(font(600, 17, fonts.mono)),
    ensureFont(font(500, 24, fonts.mono), subLine),
    ensureFont(font(400, 19, fonts.mono)),
  ]);

  const { canvas, ctx } = openCard(groundTrade, 0.3, 0.42);

  // living heat behind the hero on a win, a faint lamp on a loss
  const heat = ctx.createRadialGradient(HEAT_CX, HEAT_CY, 60, HEAT_CX, HEAT_CY, 620);
  if (look.won) {
    heat.addColorStop(0, verm(0.14));
    heat.addColorStop(0.55, verm(0.05));
    heat.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    heat.addColorStop(0, "rgba(255,250,240,0.045)");
    heat.addColorStop(1, "rgba(0,0,0,0)");
  }
  ctx.fillStyle = heat;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  drawMasthead(ctx, fonts, SHARE.brand, shortTradeId(card), look.recordType);

  ctx.font = font(600, 17, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  drawTracked(ctx, heroLabel, CARD_MARGIN, LABEL_Y, 5, "left");

  const pnlPx = fitFontPx(ctx, heroText, fonts.display, 800, 200, RECORD_W, 60);
  ctx.font = font(800, pnlPx, fonts.display);
  ctx.textAlign = "left";
  if (look.won) {
    ctx.save();
    ctx.shadowColor = verm(0.55);
    ctx.shadowBlur = 150;
    ctx.fillStyle = verm(0.9);
    ctx.fillText(heroText, CARD_MARGIN, HERO_Y);
    ctx.shadowBlur = 48;
    ctx.fillText(heroText, CARD_MARGIN, HERO_Y);
    ctx.restore();
    ctx.fillStyle = vermilion;
    ctx.fillText(heroText, CARD_MARGIN, HERO_Y);
  } else {
    ctx.fillStyle = card.outcome === "void" ? ashDim : ash;
    ctx.fillText(heroText, CARD_MARGIN, HERO_Y);
  }

  ctx.font = font(500, fitFontPx(ctx, subLine, fonts.mono, 500, 24, RECORD_W), fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(subLine, CARD_MARGIN, SUB_Y);

  ctx.font = font(400, fitFontPx(ctx, look.kindLine, fonts.mono, 400, 19, RECORD_W), fonts.mono);
  ctx.fillStyle = card.outcome === "void" ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.55)";
  ctx.fillText(look.kindLine, CARD_MARGIN, KIND_Y);

  drawPerforation(ctx);
  drawStub(ctx, fonts, palette, qr);
  const proof = [card.entryTxHash && SHARE.trade.entry(shortHash(card.entryTxHash)), card.settlementTxHash && SHARE.trade.settlementTx(shortHash(card.settlementTxHash))].filter(Boolean).join(" · ") || SHARE.trade.noTx;
  drawFooter(ctx, fonts, proof, SHARE.verifyOn, look.footerKind);
  return closeCard(canvas, ctx);
}
