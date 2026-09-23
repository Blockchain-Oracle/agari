import type { DeckCard } from "@agari/core/games";
import { isTickerSymbol } from "@agari/core/market";
import { useAssetPrice, useOpeningPrice } from "@agari/markets/react";
import { Text } from "react-native";
import { DUEL } from "@/features/games/duel/copy";
import { assetPriceLine } from "@/features/markets/hero/units";
import { StageFace, usePendingQuestionStyle, type DeckPlace } from "../stage";

/**
 * web's `DuelPicking.tsx` `DuelFace`: the Window's line as the question (the oracle's opening print, which is what
 * the Window settles against), the live price as `now`, and the tier's per-card stake. Its own component because
 * the line and the price are reads, and a read is a hook.
 */
export function DuelFace({ card, place, nowMs, stake }: { card: DeckCard; place: DeckPlace; nowMs: number | undefined; stake: string }) {
  const opening = useOpeningPrice(card.marketId);
  const lineRaw = opening?.ok ? opening.value : null;
  const price = useAssetPrice(isTickerSymbol(card.asset) ? card.asset : null);
  const spot = price?.ok ? price.value : null;
  const pending = usePendingQuestionStyle();
  return (
    <StageFace
      card={card}
      place={place}
      nowMs={nowMs}
      eyebrow={DUEL.picking.eyebrow(card.asset)}
      question={lineRaw === null ? <Text style={pending}>{DUEL.picking.questionNoLine}</Text> : DUEL.picking.question(assetPriceLine(card.asset, lineRaw))}
      pills={[
        { label: DUEL.picking.now, value: spot ? assetPriceLine(card.asset, spot.priceRaw) : "—", tone: "live" },
        { label: DUEL.picking.stake, value: stake, tone: "up" },
      ]}
    />
  );
}
