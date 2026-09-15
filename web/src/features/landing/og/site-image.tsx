import type { TickerSymbol } from "@agari/core/market";
import { ImageResponse } from "next/og";
import { LANDING } from "../copy";
import { OG_COPY } from "./copy";
import { ogFonts } from "./fonts";
import { OgFrame } from "./OgFrame";
import { OgMark } from "./OgMark";
import { OG, OG_SIZE } from "./theme";

/** Three launch names with drawn glyphs: the marks a stranger recognises before reading a word. */
const SITE_MARKS: readonly TickerSymbol[] = ["TSLA", "NVDA", "AAPL"];
const HEADLINE = { display: "flex", fontSize: 96, lineHeight: 0.95, letterSpacing: "-0.035em" } as const;

/** The site preview (`/opengraph-image`, `/twitter-image`): the wordmark, the landing's tagline and three marks. */
export async function siteImage(): Promise<ImageResponse> {
  return new ImageResponse(
    <OgFrame eyebrow={OG_COPY.site.eyebrow}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...HEADLINE, color: OG.ink }}>{LANDING.hero.titleLead}</div>
          <div style={{ ...HEADLINE, color: OG.vermilion }}>{LANDING.hero.titleEm}</div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 32, color: OG.soft }}>{OG_COPY.site.line}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {SITE_MARKS.map((symbol) => (
            <OgMark key={symbol} symbol={symbol} size={96} />
          ))}
        </div>
      </div>
    </OgFrame>,
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
