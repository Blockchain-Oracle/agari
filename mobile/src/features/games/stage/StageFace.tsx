import type { DeckCard } from "@agari/core/games";
import { formatClock } from "@agari/core/units";
import { Clock as ClockIcon } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { STAGE } from "@/features/games/stage/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import { PIXEL_FONT } from "~/theme/web/games";
import { ArtWindow } from "./ArtWindow";
import { cadenceLabel } from "./cadence";
import { useStageTokens } from "./tokens";
import { useStageFeel } from "./useStageFeel";

/**
 * web's `StageFace` (stage.css): one card's face in Flicky's bands — the title banner (asset, cadence, N/M in the
 * pixel face), the CRT art window whose mascot reacts to the lean, the quote box (eyebrow, question, settle clock)
 * and the two stat pills. The deck draws the calls. The countdown is always the Window's real expiry.
 *
 * `question` may be a string or a node; pass a `<Text>` in `usePendingQuestionStyle()` for web's pending line.
 */

/** Flicky's ramp on every clock: calm, then vermilion inside ten minutes, then the loss colour inside two. */
export function clockUrgency(remainingSec: number): { level: "calm" | "near" | "last"; pulse: boolean } {
  return { level: remainingSec <= 120 ? "last" : remainingSec <= 600 ? "near" : "calm", pulse: remainingSec > 0 && remainingSec <= 30 };
}

/** One of the two live figures under the question — the reference's `now` and `stake` pills. */
export interface StagePill {
  label: string;
  value: ReactNode;
  tone?: "up" | "down" | "live";
}

export interface StageFaceProps {
  card: DeckCard;
  place: { position: number; total: number };
  eyebrow: string;
  question: ReactNode;
  pills: readonly StagePill[];
  /** Chain-corrected now; omitted, the clock ticks off the device. 0 draws the pending clock. */
  nowMs?: number;
}

/** `.st-band`: a step of the ground, the hairline, a light line inside the top edge and a shadow line inside the bottom. */
export function useBandStyle() {
  const { s } = useStageTokens();
  return [styles.band, { backgroundColor: s.bandBg, borderColor: s.bandBorder, boxShadow: `inset 0 2px 0 ${s.bandLipTop}, inset 0 -2px 0 ${s.bandLipBottom}` }];
}

export function StageFace({ card, place, eyebrow, question, pills, nowMs }: StageFaceProps) {
  const { s, color } = useStageTokens();
  const band = useBandStyle();
  const remainingSec = card.expirySec - Math.floor((nowMs ?? Date.now()) / 1_000);
  const urgency = clockUrgency(remainingSec);
  const clockInk = urgency.level === "calm" ? color.profit : urgency.level === "near" ? color.accent : color.loss;
  const clockText = nowMs === 0 ? STAGE.clockPending : remainingSec <= 0 ? STAGE.settling : STAGE.settlesIn(formatClock(remainingSec));

  return (
    <>
      <View style={[band, styles.title]}>
        <View style={styles.titleAsset}>
          <AssetDisc asset={card.asset} size={16} />
          <Text style={[styles.pixelLg, { color: color.accent }]} numberOfLines={1}>
            {STAGE.pair(card.asset).toUpperCase()}
          </Text>
        </View>
        <View style={[styles.cadence, { borderColor: s.cadenceBorder }]}>
          <Text style={[styles.cadenceText, { color: color.inkSecondary }]}>{cadenceLabel(card.intervalSec)}</Text>
        </View>
        <Text style={[styles.pixelLg, styles.place, { color: color.inkMuted }]}>
          {place.position}/{place.total}
        </Text>
      </View>

      <ArtWindow />

      <View style={[band, styles.quote]}>
        <View pointerEvents="none" style={[styles.quoteInset, { borderColor: s.quoteInset }]} />
        <Text style={[styles.eyebrow, { color: s.eyebrow }]} numberOfLines={1}>
          {eyebrow.toUpperCase()}
        </Text>
        {typeof question === "string" ? <Text style={[styles.question, { color: color.ink }]}>{question}</Text> : question}
        <Clock text={clockText} ink={clockInk} pulse={urgency.pulse} />
      </View>

      <View style={styles.pills}>
        {pills.map((pill) => (
          <View key={pill.label} style={[band, styles.pill]}>
            <Text style={[styles.pillKey, { color: color.inkMuted }]}>{pill.label.toUpperCase()}</Text>
            {typeof pill.value === "string" ? (
              <Text style={[pillValueStyle, { color: pill.tone === "up" ? color.profit : pill.tone === "down" ? color.loss : color.ink }]} numberOfLines={1}>
                {pill.value}
              </Text>
            ) : (
              pill.value
            )}
          </View>
        ))}
      </View>
    </>
  );
}

/** The style a pending question takes (web's `.st-question-pending`), for a face that passes its own `<Text>`. */
export function usePendingQuestionStyle() {
  const { color } = useStageTokens();
  return [styles.question, { color: color.inkMuted }];
}

/** `.st-pill-v`: the pixel face at 22 / 1, for a face that passes its own value node. */
export const pillValueStyle: TextStyle = { fontFamily: PIXEL_FONT, fontSize: 22, lineHeight: 22, fontVariant: ["tabular-nums"] };

/** `.st-clock`: the lucide clock and the line in the pixel face, pulsing brighter in the last thirty seconds. */
function Clock({ text, ink, pulse }: { text: string; ink: string; pulse: boolean }) {
  const { reducedMotion } = useStageFeel();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (pulse && !reducedMotion) {
      glow.value = withRepeat(withTiming(0.6, { duration: 400 }), -1, true);
    } else {
      cancelAnimation(glow);
      glow.value = 1;
    }
  }, [pulse, reducedMotion, glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={[styles.clock, style]} accessibilityRole="timer" accessibilityLabel={text}>
      <ClockIcon size={13} color={ink} strokeWidth={2} />
      <Text style={[styles.clockText, { color: ink }]}>{text.toUpperCase()}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: { borderRadius: 10, borderWidth: 1 },
  title: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10 },
  titleAsset: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  pixelLg: { fontFamily: PIXEL_FONT, fontSize: 16, lineHeight: 25.6, letterSpacing: 2.88 },
  cadence: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, borderWidth: 1 },
  cadenceText: { fontFamily: PIXEL_FONT, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.66 },
  place: { marginLeft: "auto", fontVariant: ["tabular-nums"] },
  quote: { gap: 4, paddingVertical: 10, paddingHorizontal: 12 },
  quoteInset: { position: "absolute", top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderRadius: 7 },
  eyebrow: { fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 22.4, letterSpacing: 3.08 },
  question: { fontFamily: FONT.headingHeavy, fontSize: 26, lineHeight: 27.3, letterSpacing: -0.52 },
  clock: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  clockText: { fontFamily: PIXEL_FONT, fontSize: 14, lineHeight: 22.4, letterSpacing: 2.8, fontVariant: ["tabular-nums"] },
  pills: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 6, paddingHorizontal: 10 },
  pillKey: { fontFamily: PIXEL_FONT, fontSize: 12, lineHeight: 19.2, letterSpacing: 2.4 },
});
