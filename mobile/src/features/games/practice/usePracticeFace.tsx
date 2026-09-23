import { PRICE_STALE_AFTER_MS } from "@agari/core/constants";
import type { DeckCard } from "@agari/core/games";
import { secToMs } from "@agari/core/units";
import { useCallback } from "react";
import { Text } from "react-native";
import { assetPriceLine, feedRawToOracleRaw } from "@/features/markets/hero/units";
import { PRACTICE } from "@/features/games/practice/copy";
import { StageFace, type DeckPlace } from "~/features/games/stage";
import { FONT, useTheme } from "~/theme";
import type { PracticeSession } from "./usePracticeRound";

/**
 * web's PracticeStage `renderFace`: the shared StageFace with Practice's one real number, the live price
 * (marked aged past the staleness line, never dropped), and "stake: none".
 */
export function usePracticeFace(session: PracticeSession) {
  const { color } = useTheme();
  return useCallback(
    (card: DeckCard, place: DeckPlace) => {
      const price = session.priceOf(card.asset);
      const agedMs = price ? session.nowMs - secToMs(price.publishTimeSec) : 0;
      const aged = price !== null && session.nowMs > 0 && agedMs > PRICE_STALE_AFTER_MS;
      const live = price ? (
        <Text style={{ color: color.ink, fontFamily: FONT.dataStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
          {assetPriceLine(card.asset, feedRawToOracleRaw(price.priceRaw, price.decimals))}
          {aged ? <Text style={{ color: color.warning, fontFamily: FONT.data, fontSize: 10 }}>{"  aged"}</Text> : null}
        </Text>
      ) : (
        <Text style={{ color: color.inkMuted, fontFamily: FONT.body, fontSize: 12 }}>{PRACTICE.card.noPrice}</Text>
      );
      return (
        <StageFace
          card={card}
          place={place}
          nowMs={session.nowMs || undefined}
          eyebrow={PRACTICE.card.eyebrow(card.asset)}
          question={PRACTICE.card.question}
          pills={[
            { label: PRACTICE.card.live, value: live, tone: "live" },
            { label: PRACTICE.card.stake, value: PRACTICE.card.noStake },
          ]}
        />
      );
    },
    [session, color],
  );
}
