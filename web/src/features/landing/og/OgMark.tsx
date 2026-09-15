import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { glyphTransform, MARK_GLYPHS } from "@/components/icons/asset-marks/paths";
import { OG } from "./theme";

/**
 * An asset mark for satori: `AssetMarkSvg`'s drawing (the 32-unit disc in the registry's brand colour, the vendored
 * glyph placed by `glyphTransform`) with its fills inline, because satori never sees `icons.css`. A brand without a
 * glyph (the ETFs) types its registry monogram on the disc, as the app does.
 */
export function OgMark({ symbol, size }: { symbol: TickerSymbol; size: number }) {
  const { brand, monogram } = TICKERS[symbol];
  const glyph = MARK_GLYPHS[brand.slug];
  if (!glyph) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: size / 2,
          background: brand.hex,
          color: OG.ink,
          fontSize: Math.round((size * 17) / 32),
        }}
      >
        {monogram}
      </div>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill={brand.hex} />
      {glyph.ring && <circle cx="16" cy="16" r="15.5" fill="none" stroke={OG.ring} strokeWidth="1" />}
      <path d={glyph.d} fill={OG.ink} transform={glyphTransform(glyph)} />
    </svg>
  );
}
