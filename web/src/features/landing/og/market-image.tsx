import { ImageResponse } from "next/og";
import { etWhen, laneAssetLabel, laneTabLabel } from "../../markets/lanes/lane-view";
import { OG_COPY } from "./copy";
import { ogFonts } from "./fonts";
import { readMarketCard, type MarketCard } from "./market-data";
import { OgFrame } from "./OgFrame";
import { OgMark } from "./OgMark";
import { OG, OG_SIZE } from "./theme";

const QUESTION = { display: "flex", fontSize: 104, lineHeight: 1, letterSpacing: "-0.035em", color: OG.vermilion } as const;

function Known({ card }: { card: MarketCard }) {
  const when = etWhen(card.expirySec);
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
      <OgMark symbol={card.asset} size={184} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 64, letterSpacing: "-0.03em", color: OG.ink }}>{laneAssetLabel(card.asset, card.lane)}</div>
          <div
            style={{
              display: "flex",
              paddingTop: 6,
              paddingBottom: 6,
              paddingLeft: 18,
              paddingRight: 18,
              borderRadius: 999,
              borderWidth: 2,
              borderStyle: "solid",
              borderColor: OG.hairline,
              fontSize: 30,
              color: OG.soft,
            }}
          >
            {laneTabLabel(card.lane, card.intervalSec)}
          </div>
        </div>
        <div style={{ ...QUESTION, marginTop: 20 }}>{OG_COPY.market.question}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: OG.soft }}>
          {card.settled ? OG_COPY.market.closedAt(when) : OG_COPY.market.closesAt(when)}
        </div>
      </div>
    </div>
  );
}

function Unknown() {
  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
      <div style={QUESTION}>{OG_COPY.market.question}</div>
      <div style={{ display: "flex", marginTop: 24, fontSize: 32, color: OG.soft }}>{OG_COPY.market.unknown}</div>
    </div>
  );
}

/** A Window's preview (`/markets/<id>/opengraph-image`): the mark, the lane's cadence, "Up or Down?" and when it closes. */
export async function marketImage(id: string): Promise<ImageResponse> {
  const [fonts, card] = await Promise.all([ogFonts(), readMarketCard(id)]);
  return new ImageResponse(
    <OgFrame eyebrow={OG_COPY.market.eyebrow}>{card ? <Known card={card} /> : <Unknown />}</OgFrame>,
    { ...OG_SIZE, fonts },
  );
}
