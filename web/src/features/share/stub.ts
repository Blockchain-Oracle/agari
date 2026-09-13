import qrcode from "qrcode-generator";
import { CARD_MARGIN, CARD_W, STUB_LEFT, drawTracked, font, type CardFonts, type CardPalette } from "./canvas";
import { SHARE } from "./copy";

/**
 * The stub — the part of the ticket torn off past the perforation: a "scan"
 * eyebrow, the brand's home as a QR on a cream tile, the site and the X handle.
 * Ours, not the reference's: its cards carried no handle because none existed.
 */

const STUB_CX = (STUB_LEFT + CARD_W - CARD_MARGIN) / 2;
const EYEBROW_Y = 214;
const TILE = 330;
const TILE_Y = 246;
const TILE_RADIUS = 14;
/** The quiet zone the QR spec asks for, in modules, on every side. */
const QUIET_MODULES = 4;
const SITE_Y = 640;
const HANDLE_Y = 684;

export interface QrMatrix {
  count: number;
  isDark(row: number, col: number): boolean;
}

/** Byte-mode QR at error level M, at the smallest version that holds the text. */
export function encodeQr(text: string): QrMatrix {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return { count: qr.getModuleCount(), isDark: (row, col) => qr.isDark(row, col) };
}

/** Modules snap to whole card units so the downscale never blurs a cell edge into its neighbour. */
function drawQr(ctx: CanvasRenderingContext2D, qr: QrMatrix, tileX: number, tileY: number, ink: string): void {
  const module = Math.floor(TILE / (qr.count + 2 * QUIET_MODULES));
  const size = module * qr.count;
  const ox = Math.floor(tileX + (TILE - size) / 2);
  const oy = Math.floor(tileY + (TILE - size) / 2);
  ctx.fillStyle = ink;
  for (let row = 0; row < qr.count; row += 1) {
    for (let col = 0; col < qr.count; col += 1) {
      if (qr.isDark(row, col)) ctx.fillRect(ox + col * module, oy + row * module, module, module);
    }
  }
}

export function drawStub(ctx: CanvasRenderingContext2D, fonts: CardFonts, palette: CardPalette, qr: QrMatrix): void {
  ctx.font = font(600, 14, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  drawTracked(ctx, SHARE.scan, STUB_CX, EYEBROW_Y, 5, "center");

  const tileX = STUB_CX - TILE / 2;
  ctx.fillStyle = palette.paper;
  ctx.beginPath();
  ctx.roundRect(tileX, TILE_Y, TILE, TILE, TILE_RADIUS);
  ctx.fill();
  drawQr(ctx, qr, tileX, TILE_Y, palette.qrInk);

  ctx.font = font(800, 30, fonts.display);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.textAlign = "center";
  ctx.fillText(SHARE.site, STUB_CX, SITE_Y);

  ctx.font = font(500, 20, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  drawTracked(ctx, SHARE.handle, STUB_CX, HANDLE_Y, 2, "center");
}
