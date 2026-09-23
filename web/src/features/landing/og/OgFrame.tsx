import type { ReactNode } from "react";
import { BRAND } from "@/lib/copy";
import { OG_COPY } from "./copy";
import { OG, OG_PAD } from "./theme";
import { AGARI_MARK_FIGURE, AGARI_MARK_OUTCOME } from "@/components/shell/AgariMark";

const CROP = 28;
const CROP_INSET = 32;

/** Masayume's `.crop` corner marks (part-04), one L per corner, drawn with per-side borders satori understands. */
function Crop({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
  const top = at[0] === "t";
  const left = at[1] === "l";
  return (
    <div
      style={{
        position: "absolute",
        width: CROP,
        height: CROP,
        ...(top ? { top: CROP_INSET } : { bottom: CROP_INSET }),
        ...(left ? { left: CROP_INSET } : { right: CROP_INSET }),
        ...(top ? { borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: OG.crop } : { borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: OG.crop }),
        ...(left ? { borderLeftWidth: 1, borderLeftStyle: "solid", borderLeftColor: OG.crop } : { borderRightWidth: 1, borderRightStyle: "solid", borderRightColor: OG.crop }),
      }}
    />
  );
}

/**
 * The Agari mark at preview size uses the same paths as the app component.
 */
function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width={43} height={43} viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
        <path d={AGARI_MARK_FIGURE} fill={OG.ink} />
        <path d={AGARI_MARK_OUTCOME} fill={OG.vermilion} />
      </svg>
      <div style={{ display: "flex", fontSize: 30, letterSpacing: "0.22em", color: OG.ink }}>{BRAND.name.toUpperCase()}</div>
    </div>
  );
}

interface OgFrameProps {
  eyebrow: string;
  children: ReactNode;
}

/** Every preview: the dark ground, the crop marks, the wordmark and an eyebrow on top, the honesty line at the foot. */
export function OgFrame({ eyebrow, children }: OgFrameProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: OG_PAD,
        background: OG.ground,
        color: OG.ink,
        fontFamily: "Sora",
      }}
    >
      <Crop at="tl" />
      <Crop at="tr" />
      <Crop at="bl" />
      <Crop at="br" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark />
        <div style={{ display: "flex", fontSize: 18, letterSpacing: "0.18em", textTransform: "uppercase", color: OG.dim }}>{eyebrow}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      {/* Not uppercased: "tUSDC" is a name with fixed casing, and "TUSDC" reads as a different token. */}
      <div style={{ display: "flex", fontSize: 22, letterSpacing: "0.04em", color: OG.dim }}>{OG_COPY.honesty}</div>
    </div>
  );
}
