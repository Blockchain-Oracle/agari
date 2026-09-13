/**
 * The share cards' drawing kit — the helpers `lib/shareCard.ts` and
 * `lib/openBetShareCard.ts` each carry a copy of in the reference, kept once.
 *
 * Both cards are a landscape 1600×900 (16:9) PNG — the one ratio X shows uncropped
 * in the timeline on both web and phone — drawn at 2× on an offscreen canvas and
 * downscaled for crisp type. The frame is the reference's ticket language turned on
 * its side: near-black ground, registration ticks, the masthead, and a vertical
 * perforation tearing the record (left) from a stub (right) that carries the QR,
 * the site and the handle. A shareable image has one design, so these values do
 * not follow the page theme — the on-screen preview does (share-card.css).
 */

export const CARD_W = 1600;
export const CARD_H = 900;
export const CARD_SCALE = 2;
export const CARD_MARGIN = 72;
/** The vertical perforation between the record and the stub. */
export const STUB_RULE_X = 1088;
/** The record's right edge and the stub's left edge, either side of the perforation. */
export const RECORD_RIGHT = STUB_RULE_X - 48;
export const STUB_LEFT = STUB_RULE_X + 48;
export const RECORD_W = RECORD_RIGHT - CARD_MARGIN;

const TICK_INSET = 40;
const MASTHEAD_Y = 92;
const MASTHEAD_RULE_Y = 124;
const RECORD_TYPE_Y = 178;
const RULE_TOP = 160;
const RULE_BOTTOM = 776;
const FOOTER_RULE_Y = 800;
const FOOTER_Y = 846;

/** Every colour the cards draw comes from share-card.css; these are the no-stylesheet fallbacks, as rgb() so no hex lives in code. */
const FALLBACK_VERMILION = "rgb(224 77 38)";
const DISPLAY_FALLBACK = "'Sora', system-ui, sans-serif";
const MONO_FALLBACK = "'JetBrains Mono', ui-monospace, monospace";

export interface CardPalette {
  vermilion: string;
  verm: (alpha: number) => string;
  /** The Call's flat near-black. */
  groundCall: string;
  /** Earned Heat's warmer near-black. */
  groundTrade: string;
  /** The drained loss tone — NOT red. */
  ash: string;
  ashDim: string;
  /** The QR tile — Yosuku's light-card paper — and the ink the modules take on it. */
  paper: string;
  qrInk: string;
}

/** A canvas font shorthand; sizes are card-space numbers, never a px literal in code. */
export const font = (weight: number, size: number, family: string): string => `${weight} ${size}px ${family}`;

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
}

export interface CardFonts {
  display: string;
  mono: string;
}

/** next/font families are hash-named, so the family is read off a probe element rather than guessed. */
function resolveFontFamily(cssVar: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  try {
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.fontFamily = `var(${cssVar}, ${fallback})`;
    probe.textContent = " ";
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    return family && family.trim() ? `${family}, ${fallback}` : fallback;
  } catch {
    return fallback;
  }
}

export function resolveFonts(): CardFonts {
  return { display: resolveFontFamily("--font-display", DISPLAY_FALLBACK), mono: resolveFontFamily("--font-mono", MONO_FALLBACK) };
}

export async function ensureFont(spec: string, sample?: string): Promise<void> {
  try {
    if (typeof document !== "undefined" && document.fonts?.load) await document.fonts.load(spec, sample);
  } catch {
    // fall back silently — canvas uses the next family in the stack
  }
}

/** Reads a hex or rgb() colour into channels; anything else falls back to the vermilion channels. */
function toRgb(color: string): [number, number, number] {
  const hex = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const rgb = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : [224, 77, 38];
}

/** The live `--vermilion` and the cards' own tokens (share-card.css), so the heat is the page's, not a second red. */
export function resolvePalette(): CardPalette {
  const vermilion = cssVar("--vermilion", FALLBACK_VERMILION);
  const [r, g, b] = toRgb(vermilion);
  return {
    vermilion,
    verm: (alpha) => `rgba(${r},${g},${b},${alpha})`,
    groundCall: cssVar("--share-ground-call", "rgb(10 9 8)"),
    groundTrade: cssVar("--share-ground-trade", "rgb(7 5 5)"),
    ash: cssVar("--share-ash", "rgb(143 138 130)"),
    ashDim: cssVar("--share-ash-dim", "rgba(143,138,130,0.55)"),
    paper: cssVar("--share-paper", "rgb(253 248 239)"),
    qrInk: cssVar("--share-qr-ink", "rgb(20 18 16)"),
  };
}

/** Manual letter-spacing — canvas `letterSpacing` is not portable. */
export function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number, align: "left" | "center" | "right" = "left"): number {
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i += 1) {
    ctx.fillText(chars[i]!, cx, y);
    cx += widths[i]! + tracking;
  }
  ctx.textAlign = prevAlign;
  return total;
}

/** Largest px ≤ basePx at which `text` fits `maxWidth`. */
export function fitFontPx(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, basePx: number, maxWidth: number, minPx = 36): number {
  ctx.font = `${weight} ${basePx}px ${family}`;
  const width = ctx.measureText(text).width;
  if (width <= maxWidth) return basePx;
  return Math.max(minPx, Math.floor((basePx * maxWidth) / width));
}

/** A sparse noise tile → film grain pattern; ~5.5% of pixels at a low alpha. */
function makeGrainTile(size = 140): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const x = tile.getContext("2d")!;
  const image = x.createImageData(size, size);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = Math.random() < 0.5 ? 0 : 14;
  }
  x.putImageData(image, 0, 0);
  return tile;
}

/** A 2× canvas with the ground laid down: flat near-black, a vignette, and the four registration ticks. */
export function openCard(ground: string, vignetteInner: number, vignetteAlpha: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (typeof document === "undefined") throw new Error("share cards render in the browser");
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * CARD_SCALE;
  canvas.height = CARD_H * CARD_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.scale(CARD_SCALE, CARD_SCALE);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const vignette = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, CARD_H * vignetteInner, CARD_W / 2, CARD_H / 2, CARD_W * 0.6);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${vignetteAlpha})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  const tick = 9;
  const far = { x: CARD_W - TICK_INSET, y: CARD_H - TICK_INSET };
  for (const [tx, ty] of [[TICK_INSET, TICK_INSET], [far.x, TICK_INSET], [TICK_INSET, far.y], [far.x, far.y]] as const) {
    ctx.beginPath();
    ctx.moveTo(tx - tick, ty);
    ctx.lineTo(tx + tick, ty);
    ctx.moveTo(tx, ty - tick);
    ctx.lineTo(tx, ty + tick);
    ctx.stroke();
  }
  return { canvas, ctx };
}

/** MASAYUME (left) · N° folio (right), the hairline under them, and the record-type line on the record's edge. */
export function drawMasthead(ctx: CanvasRenderingContext2D, fonts: CardFonts, brand: string, folio: string, recordType: string): void {
  ctx.textAlign = "left";
  ctx.font = font(800, 26, fonts.display);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  drawTracked(ctx, brand, CARD_MARGIN, MASTHEAD_Y, 7, "left");
  ctx.font = font(600, 17, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.40)";
  drawTracked(ctx, `N° ${folio}`, CARD_W - CARD_MARGIN, MASTHEAD_Y - 2, 3, "right");

  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CARD_MARGIN, MASTHEAD_RULE_Y);
  ctx.lineTo(CARD_W - CARD_MARGIN, MASTHEAD_RULE_Y);
  ctx.stroke();

  ctx.font = font(600, 15, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  drawTracked(ctx, recordType, CARD_MARGIN, RECORD_TYPE_Y, 6, "left");
}

/** A short vermilion segment laid over the masthead hairline at the record's edge — The Call's single spark. */
export function drawSpark(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CARD_MARGIN, MASTHEAD_RULE_Y);
  ctx.lineTo(CARD_MARGIN + 56, MASTHEAD_RULE_Y);
  ctx.stroke();
}

/** The dashed perforation tearing the record from its stub. */
export function drawPerforation(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 11]);
  ctx.beginPath();
  ctx.moveTo(STUB_RULE_X, RULE_TOP);
  ctx.lineTo(STUB_RULE_X, RULE_BOTTOM);
  ctx.stroke();
  ctx.restore();
}

/** The footer hairline; the proof (the record's transaction line, then the "verify on" line) on the left, the record kind on the right. */
export function drawFooter(ctx: CanvasRenderingContext2D, fonts: CardFonts, proof: string, verifyLine: string, kind: string): void {
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CARD_MARGIN, FOOTER_RULE_Y);
  ctx.lineTo(CARD_W - CARD_MARGIN, FOOTER_RULE_Y);
  ctx.stroke();

  ctx.font = font(500, 16, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  const kindW = drawTracked(ctx, kind, CARD_W - CARD_MARGIN, FOOTER_Y - 2, 3, "right");

  const gap = 28;
  ctx.font = font(400, 14, fonts.mono);
  const verifyW = Array.from(verifyLine).reduce((w, ch) => w + ctx.measureText(ch).width, 0) + 4 * Math.max(0, verifyLine.length - 1);
  const room = CARD_W - 2 * CARD_MARGIN - kindW - gap - verifyW - gap;
  const proofPx = fitFontPx(ctx, proof, fonts.mono, 500, 19, room, 12);
  ctx.font = font(500, proofPx, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.textAlign = "left";
  ctx.fillText(proof, CARD_MARGIN, FOOTER_Y);
  const proofW = ctx.measureText(proof).width;

  ctx.font = font(400, 14, fonts.mono);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  drawTracked(ctx, verifyLine, CARD_MARGIN + proofW + gap, FOOTER_Y - 2, 4, "left");
}

/** Grain over everything, then downscale to 1600×900 and encode. */
export function closeCard(big: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Promise<Blob> {
  const pattern = ctx.createPattern(makeGrainTile(), "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  const out = document.createElement("canvas");
  out.width = CARD_W;
  out.height = CARD_H;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("canvas 2d context unavailable");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(big, 0, 0, CARD_W, CARD_H);
  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas toBlob returned null"))), "image/png");
  });
}
