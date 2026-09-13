"use client";

import { SHARE } from "./copy";
import { buildTradeTweetText, renderTradeShareCard, shortTradeId, type TradeCard } from "./trade-card";
import { useShareCard } from "./useShareCard";

/** "Share card ↗" — ported from `reference/yosuku/components/ShareTradeButton.tsx`. */
export function ShareTradeButton({ card }: { card: TradeCard }) {
  const { busy, share } = useShareCard();
  return (
    <button
      type="button"
      className="share-link"
      disabled={busy}
      aria-busy={busy}
      data-cursor="hover"
      onClick={() => void share({ render: () => renderTradeShareCard(card), fileName: `masayume-trade-${shortTradeId(card)}.png`, text: buildTradeTweetText(card) })}
    >
      {busy ? SHARE.rendering : `${SHARE.shareCard} ↗`}
    </button>
  );
}
