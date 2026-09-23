/**
 * A Canvas2D-subset recorder: web's own `ride-draw.ts` / `flap-draw.ts` paint into this instead of a canvas,
 * and it hands back one frame as a short list of SVG paths, so the picture on the phone is web's picture.
 *
 * It keeps what those two modules use — the transform (setTransform, translate, rotate, scale, save/restore),
 * fill/stroke styles and widths, rects, paths with lines and arcs, radial gradients and globalAlpha — and
 * bakes the transform into the coordinates, so nothing downstream needs a matrix. To keep a frame cheap it
 * batches: a fill or stroke that shares the previous one's style joins its path, and a fillRect joins any rect
 * of the same style in the current run of rects (a sprite's hundreds of cells become one path per colour).
 * Alphas are rounded to 1/32 so a fading trail batches into a handful of steps instead of one path per segment.
 */
export interface Stop {
  offset: number;
  color: string;
  opacity: number;
}

export interface Gradient {
  id: string;
  cx: number;
  cy: number;
  r: number;
  stops: Stop[];
}

export interface DrawOp {
  d: string;
  /** A colour, or `url(#id)` naming a gradient of this frame. */
  fill: string | null;
  stroke: string | null;
  opacity: number;
  width: number;
  cap: "butt" | "round" | "square";
  join: "miter" | "round" | "bevel";
}

export interface Frame {
  ops: DrawOp[];
  gradients: Gradient[];
}

type Paint = string | RecordedGradient;

class RecordedGradient {
  stops: { offset: number; css: string }[] = [];
  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly r0: number,
    readonly x1: number,
    readonly y1: number,
    readonly r1: number,
  ) {}
  addColorStop(offset: number, css: string): void {
    this.stops.push({ offset, css });
  }
}

interface Parsed {
  color: string;
  alpha: number;
}

const CSS_RGB = /^rgb\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:\s*\/\s*([-\d.e]+))?\)$/;
const parsedCache = new Map<string, Parsed>();

/** web's palette writes `rgb(r g b)` and `rgb(r g b / a)`; split those into a hex colour and an alpha. */
function parseCss(css: string): Parsed {
  const hit = parsedCache.get(css);
  if (hit) return hit;
  const match = CSS_RGB.exec(css);
  let parsed: Parsed = { color: css, alpha: 1 };
  if (match) {
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    const hex = ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    parsed = { color: "#" + hex, alpha: match[4] === undefined ? 1 : Number(match[4]) };
  }
  if (parsedCache.size > 4_000) parsedCache.clear();
  parsedCache.set(css, parsed);
  return parsed;
}

const quantize = (alpha: number) => Math.round(Math.min(1, Math.max(0, alpha)) * 32) / 32;
const n = (v: number) => String(Math.round(v * 10) / 10);

interface StyleState {
  m: [number, number, number, number, number, number];
  fillStyle: Paint;
  strokeStyle: Paint;
  lineWidth: number;
  lineCap: DrawOp["cap"];
  lineJoin: DrawOp["join"];
  globalAlpha: number;
}

export class CanvasRecorder {
  private ops: DrawOp[] = [];
  private keys: string[] = [];
  private gradients: Gradient[] = [];
  private gradientIds = new Map<RecordedGradient, string>();
  private rectRunStart = 0;
  private path = "";
  private hasPoint = false;
  private stack: StyleState[] = [];
  private s: StyleState = CanvasRecorder.fresh();

  private static fresh(): StyleState {
    return { m: [1, 0, 0, 1, 0, 0], fillStyle: "black", strokeStyle: "black", lineWidth: 1, lineCap: "butt", lineJoin: "miter", globalAlpha: 1 };
  }

  /** Start a frame. */
  begin(): void {
    this.ops = [];
    this.keys = [];
    this.gradients = [];
    this.gradientIds.clear();
    this.rectRunStart = 0;
    this.path = "";
    this.hasPoint = false;
    this.stack = [];
    this.s = CanvasRecorder.fresh();
  }

  /** The frame recorded since `begin`. */
  finish(): Frame {
    return { ops: this.ops, gradients: this.gradients };
  }

  // Styles.
  set fillStyle(paint: Paint) {
    this.s.fillStyle = paint;
  }
  get fillStyle(): Paint {
    return this.s.fillStyle;
  }
  set strokeStyle(paint: Paint) {
    this.s.strokeStyle = paint;
  }
  get strokeStyle(): Paint {
    return this.s.strokeStyle;
  }
  set lineWidth(width: number) {
    this.s.lineWidth = width;
  }
  get lineWidth(): number {
    return this.s.lineWidth;
  }
  set lineCap(cap: DrawOp["cap"]) {
    this.s.lineCap = cap;
  }
  set lineJoin(join: DrawOp["join"]) {
    this.s.lineJoin = join;
  }
  set globalAlpha(alpha: number) {
    this.s.globalAlpha = alpha;
  }

  // The transform.
  save(): void {
    this.stack.push({ ...this.s, m: [...this.s.m] });
  }
  restore(): void {
    const held = this.stack.pop();
    if (held) this.s = held;
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.s.m = [a, b, c, d, e, f];
  }
  translate(tx: number, ty: number): void {
    const m = this.s.m;
    m[4] += m[0] * tx + m[2] * ty;
    m[5] += m[1] * tx + m[3] * ty;
  }
  scale(sx: number, sy: number): void {
    const m = this.s.m;
    m[0] *= sx;
    m[1] *= sx;
    m[2] *= sy;
    m[3] *= sy;
  }
  rotate(angle: number): void {
    const m = this.s.m;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const [a, b, c, d] = m;
    m[0] = a * cos + c * sin;
    m[1] = b * cos + d * sin;
    m[2] = c * cos - a * sin;
    m[3] = d * cos - b * sin;
  }

  private px(x: number, y: number): string {
    const m = this.s.m;
    return n(m[0] * x + m[2] * y + m[4]) + " " + n(m[1] * x + m[3] * y + m[5]);
  }
  private get unit(): number {
    const m = this.s.m;
    return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  }

  // Paths.
  beginPath(): void {
    this.path = "";
    this.hasPoint = false;
  }
  moveTo(x: number, y: number): void {
    this.path += "M" + this.px(x, y);
    this.hasPoint = true;
  }
  lineTo(x: number, y: number): void {
    this.path += (this.hasPoint ? "L" : "M") + this.px(x, y);
    this.hasPoint = true;
  }
  closePath(): void {
    if (this.hasPoint) this.path += "Z";
  }
  arc(x: number, y: number, r: number, from: number, to: number, ccw = false): void {
    const start = this.px(x + Math.cos(from) * r, y + Math.sin(from) * r);
    this.path += (this.hasPoint ? "L" : "M") + start;
    this.hasPoint = true;
    const radius = n(r * this.unit);
    const sweep = to - from;
    if (Math.abs(sweep) >= Math.PI * 2 - 1e-6) {
      // A full turn is two half arcs: SVG cannot draw an arc back to its own start.
      const mid = this.px(x - Math.cos(from) * r, y - Math.sin(from) * r);
      this.path += "A" + radius + " " + radius + " 0 1 1 " + mid + "A" + radius + " " + radius + " 0 1 1 " + start;
      return;
    }
    const large = Math.abs(sweep) > Math.PI ? 1 : 0;
    const end = this.px(x + Math.cos(to) * r, y + Math.sin(to) * r);
    this.path += "A" + radius + " " + radius + " 0 " + large + " " + (ccw ? 0 : 1) + " " + end;
  }
  fill(): void {
    if (this.path) this.push(this.path, this.s.fillStyle, "fill", false);
  }
  stroke(): void {
    if (this.path) this.push(this.path, this.s.strokeStyle, "stroke", false);
  }
  private rectPath(x: number, y: number, w: number, h: number): string {
    return "M" + this.px(x, y) + "L" + this.px(x + w, y) + "L" + this.px(x + w, y + h) + "L" + this.px(x, y + h) + "Z";
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.push(this.rectPath(x, y, w, h), this.s.fillStyle, "fill", true);
  }
  strokeRect(x: number, y: number, w: number, h: number): void {
    this.push(this.rectPath(x, y, w, h), this.s.strokeStyle, "stroke", false);
  }

  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): RecordedGradient {
    return new RecordedGradient(x0, y0, r0, x1, y1, r1);
  }

  /** SVG's radial gradient has one centre and one radius: the inner circle becomes a hold on the first stop. */
  private gradientRef(g: RecordedGradient): string {
    let id = this.gradientIds.get(g);
    if (!id) {
      id = `ag${this.gradients.length}`;
      this.gradientIds.set(g, id);
      const u = this.unit;
      const m = this.s.m;
      const inner = g.r1 > 0 ? g.r0 / g.r1 : 0;
      const stops = g.stops.map((stop) => {
        const p = parseCss(stop.css);
        return { offset: inner + stop.offset * (1 - inner), color: p.color, opacity: p.alpha * this.s.globalAlpha };
      });
      const first = stops[0];
      if (first && inner > 0) stops.unshift({ ...first, offset: 0 });
      this.gradients.push({ id, cx: m[0] * g.x1 + m[2] * g.y1 + m[4], cy: m[1] * g.x1 + m[3] * g.y1 + m[5], r: g.r1 * u, stops });
    }
    return `url(#${id})`;
  }

  private push(d: string, paint: Paint, kind: "fill" | "stroke", rect: boolean): void {
    let color: string;
    let opacity: number;
    if (paint instanceof RecordedGradient) {
      color = this.gradientRef(paint);
      opacity = this.s.globalAlpha;
    } else {
      const p = parseCss(paint);
      color = p.color;
      opacity = quantize(p.alpha * this.s.globalAlpha);
    }
    if (opacity <= 0) return;
    const width = kind === "stroke" ? this.s.lineWidth * this.unit : 0;
    const key = kind + color + "|" + opacity + "|" + (kind === "stroke" ? width + this.s.lineCap + this.s.lineJoin : "");

    if (rect) {
      for (let i = this.rectRunStart; i < this.ops.length; i += 1) {
        if (this.keys[i] === key) {
          this.ops[i]!.d += d;
          return;
        }
      }
    } else {
      const last = this.ops.length - 1;
      if (last >= 0 && this.keys[last] === key) {
        this.ops[last]!.d += d;
        this.rectRunStart = this.ops.length;
        return;
      }
    }

    this.ops.push({
      d,
      fill: kind === "fill" ? color : null,
      stroke: kind === "stroke" ? color : null,
      opacity,
      width,
      cap: this.s.lineCap,
      join: this.s.lineJoin,
    });
    this.keys.push(key);
    if (!rect) this.rectRunStart = this.ops.length;
  }
}
