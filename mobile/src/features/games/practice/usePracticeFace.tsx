import { PRICE_STALE_AFTER_MS } from "@agari/core/constants";
import type { DeckCard } from "@agari/core/games";
import { secToMs } from "@agari/core/units";
import { TriangleAlert } from "lucide-react-native";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PRACTICE } from "@/features/games/practice/copy";
import { assetPriceLine, feedRawToOracleRaw } from "@/features/markets/hero/units";
import { STALE_REASON_LABEL } from "@/lib/copy";
import { pillValueStyle, StageFace, useStageTokens, type DeckPlace } from "~/features/games/stage";
import { FONT } from "~/theme";
import type { PracticeSession } from "./usePracticeRound";

/**
 * web's PracticeStage `renderFace`: the shared StageFace with Practice's one real number — the live price, with
 * web's compact `StaleTick` beside it past the staleness line, never dropped — and "stake: none".
 */
export function usePracticeFace(session: PracticeSession) {
  const { color } = useStageTokens();
  return useCallback(
    (card: DeckCard, place: DeckPlace) => {
      const price = session.priceOf(card.asset);
      const agedMs = price ? session.nowMs - secToMs(price.publishTimeSec) : 0;
      const aged = price !== null && session.nowMs > 0 && agedMs > PRICE_STALE_AFTER_MS;
      const live = price ? (
        <View style={styles.live}>
          <Text style={[pillValueStyle, styles.shrink, { color: color.ink }]} numberOfLines={1}>
            {assetPriceLine(card.asset, feedRawToOracleRaw(price.priceRaw, price.decimals))}
          </Text>
          {aged ? (
            <View style={styles.stale} accessibilityRole="text" accessibilityLiveRegion="polite">
              <TriangleAlert size={14} color={color.warning} strokeWidth={2} />
              <Text style={[styles.staleText, { color: color.warning }]}>{STALE_REASON_LABEL.aged}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={[pillValueStyle, { color: color.inkMuted }]} numberOfLines={1}>
          {PRACTICE.card.noPrice}
        </Text>
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

const styles = StyleSheet.create({
  live: { flexDirection: "row", alignItems: "center", gap: 4 },
  shrink: { flexShrink: 1 },
  stale: { flexDirection: "row", alignItems: "center", gap: 4 },
  staleText: { fontFamily: FONT.body, fontSize: 13, lineHeight: 19 },
});
