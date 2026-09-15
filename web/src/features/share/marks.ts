import { assetTicker } from "@agari/core/market";
import { MARK_GLYPHS, MONOGRAM_UNITS, glyphBox } from "@/components/icons/asset-marks/paths";
import { TOKEN_BADGE } from "@/features/markets/hero/asset-mark";
import { font, type CardFonts } from "./canvas";

/**
 * The asset's mark on the share cards (D-085) — the disc `AssetMarkSvg` draws, on the canvas: the brand
 * circle from `TICKERS[sym].brand.hex` by import (a card has no stylesheet to read), the white glyph as
 * a `Path2D` placed by the same `glyphBox()` numbers, or the typed monogram, and the token badge over a
 * share token's mark. Synchronous — nothing is fetched, so the card renders inside the share gesture.
 */
export const CARD_MARK = 56;
/** Between the mark and the eyebrow beside it. */
export const CARD_MARK_GAP = 16;

const INK = "rgb(255 255 255)";
const RING = "rgba(255,255,255,0.22)";
const NEUTRAL_DISC = "rgba(255,255,255,0.1)";
/** The cards' near-black, under the badge. */
const BADGE_GROUND = "rgb(10 9 8)";

export function drawAssetMark(ctx: CanvasRenderingContext2D, symbol: string, x: number, y: number, size: number, fonts: CardFonts): void {
  const found = assetTicker(symbol);
  const glyph = found ? MARK_GLYPHS[found.ticker.brand.slug] : undefined;
  const u = size / 32;
  const cx = x + size / 2;
  const cy = y + size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = found ? found.ticker.brand.hex : NEUTRAL_DISC;
  ctx.fill();
  if (glyph?.ring) {
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - u / 2, 0, Math.PI * 2);
    ctx.strokeStyle = RING;
    ctx.lineWidth = u;
    ctx.stroke();
  }

  ctx.fillStyle = INK;
  if (glyph) {
    const { k, x0, y0 } = glyphBox(glyph);
    ctx.translate(x + x0 * u, y + y0 * u);
    ctx.scale(k * u, k * u);
    ctx.fill(new Path2D(glyph.d));
  } else {
    ctx.font = font(800, MONOGRAM_UNITS * u, fonts.display);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(found ? found.ticker.monogram : symbol.slice(0, 1).toUpperCase(), cx, cy + u * 0.5);
  }
  ctx.restore();

  if (found?.token) drawBadge(ctx, TOKEN_BADGE[found.token], x + size, y + size, size, fonts);
}

/** The issuer's tag on the disc's lower edge, as `.has-mark[data-xstock]::after` hangs it. */
function drawBadge(ctx: CanvasRenderingContext2D, text: string, right: number, bottom: number, size: number, fonts: CardFonts): void {
  const r = size * 0.19;
  const cx = right - r + size * 0.05;
  const cy = bottom - r + size * 0.05;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = BADGE_GROUND;
  ctx.fill();
  ctx.strokeStyle = RING;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = font(600, size * 0.25, fonts.mono);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + size * 0.01);
  ctx.restore();
}
