import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { ImageResponse } from "next/og";
import { OG_COPY } from "./copy";
import { ogFonts } from "./fonts";
import { OgFrame } from "./OgFrame";
import { OgMark } from "./OgMark";
import { OG, OG_SIZE } from "./theme";
import { readTickerClose, type TickerClose } from "./ticker-data";

function CloseBlock({ close }: { close: TickerClose | null }) {
  if (!close) return <div style={{ display: "flex", marginTop: 28, fontSize: 36, color: OG.soft }}>{OG_COPY.ticker.noPrice}</div>;
  const tone = close.change?.direction === "down" ? OG.down : close.change?.direction === "up" ? OG.up : OG.soft;
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
        <div style={{ display: "flex", fontSize: 72, letterSpacing: "-0.03em", color: OG.ink }}>{close.price}</div>
        {close.change && (
          <div style={{ display: "flex", fontSize: 40, color: tone }}>
            {close.change.dollars} · {close.change.percent}
          </div>
        )}
      </div>
      <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: OG.dim }}>{OG_COPY.ticker.lastClose(close.when)}</div>
    </div>
  );
}

/** A ticker's preview (`/tickers/<SYMBOL>/opengraph-image`): its mark, symbol and name, and the last close with the move. */
export async function tickerImage(symbol: TickerSymbol): Promise<ImageResponse> {
  const [fonts, close] = await Promise.all([ogFonts(), readTickerClose(symbol)]);
  return new ImageResponse(
    <OgFrame eyebrow={OG_COPY.ticker.eyebrow}>
      <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
        <OgMark symbol={symbol} size={184} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <div style={{ display: "flex", fontSize: 112, lineHeight: 1, letterSpacing: "-0.035em", color: OG.ink }}>{symbol}</div>
            <div style={{ display: "flex", fontSize: 40, color: OG.soft }}>{TICKERS[symbol].name}</div>
          </div>
          <CloseBlock close={close} />
        </div>
      </div>
    </OgFrame>,
    { ...OG_SIZE, fonts },
  );
}
