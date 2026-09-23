import type { DeckCard } from "@agari/core/games";
import { formatClock } from "@agari/core/units";
import { SymbolView } from "expo-symbols";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { STAGE } from "@/features/games/stage/copy";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, useTheme } from "~/theme";
import { useLean } from "./lean";
import { BearMark, BullMark, CoinMark } from "../shell/PixelArt";
import { cadenceLabel } from "./cadence";
import { useStageFeel } from "./useStageFeel";

/**
 * web's `features/games/stage/StageFace.tsx`: one card's face in Flicky's bands — the title banner (asset, cadence,
 * N/M), the art window whose mascot reacts to the lean, the quote box (eyebrow, question, settle clock) and the two
 * stat pills. The deck draws the calls. The countdown is always the Window's real expiry.
 *
 * Props match web's: { card, place, eyebrow, question, pills, nowMs }. `question` may be a string or a node; pass
 * a `<Text>` for a styled one (the pending line uses `pendingQuestionStyle`).
 */

/** Flicky's ramp on every clock: calm, then vermilion inside ten minutes, then the loss colour inside two. */
export function clockUrgency(remainingSec: number): { level: "calm" | "near" | "last"; pulse: boolean } {
  return {
    level: remainingSec <= 120 ? "last" : remainingSec <= 600 ? "near" : "calm",
    pulse: remainingSec > 0 && remainingSec <= 30,
  };
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

export function StageFace({ card, place, eyebrow, question, pills, nowMs }: StageFaceProps) {
  const { color } = useTheme();
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const remainingSec = card.expirySec - Math.floor((nowMs ?? Date.now()) / 1_000);
  const urgency = clockUrgency(remainingSec);
  const clockInk = urgency.level === "calm" ? color.profit : urgency.level === "near" ? color.accent : color.loss;
  const clockText = nowMs === 0 ? STAGE.clockPending : remainingSec <= 0 ? STAGE.settling : STAGE.settlesIn(formatClock(remainingSec));
  const band = [styles.band, { backgroundColor: color.ground, borderColor: color.hairline }];

  return (
    <>
      <View style={[band, styles.title]}>
        <View style={styles.titleAsset}>
          <AssetDisc asset={card.asset} size={16} />
          <Text style={[styles.pixelLg, { color: color.accent }]} numberOfLines={1}>
            {STAGE.pair(card.asset).toUpperCase()}
          </Text>
        </View>
        <View style={[styles.cadence, { borderColor: color.hairline }]}>
          <Text style={[styles.pixelSm, { color: color.inkSecondary }]}>{cadenceLabel(card.intervalSec)}</Text>
        </View>
        <Text style={[styles.pixelLg, styles.place, { color: color.inkMuted }]}>
          {place.position}/{place.total}
        </Text>
      </View>

      <ArtWindow compact={compact} />

      <View style={[band, styles.quote]}>
        <View pointerEvents="none" style={[styles.quoteInset, { borderColor: color.hairline }]} />
        <Text style={[styles.eyebrow, { color: color.accent }]} numberOfLines={1}>
          {eyebrow.toUpperCase()}
        </Text>
        {typeof question === "string" ? (
          <Text style={[styles.question, compact && styles.questionCompact, { color: color.ink }]} numberOfLines={2}>
            {question}
          </Text>
        ) : (
          question
        )}
        <Clock text={clockText} ink={clockInk} pulse={urgency.pulse} />
      </View>

      <View style={styles.pills}>
        {pills.map((pill) => (
          <View key={pill.label} style={[band, styles.pill]}>
            <Text style={[styles.pillKey, { color: color.inkMuted }]}>{pill.label.toUpperCase()}</Text>
            {typeof pill.value === "string" ? (
              <Text
                style={[styles.pillValue, { color: pill.tone === "up" ? color.profit : pill.tone === "down" ? color.loss : color.ink }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
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
  const { color } = useTheme();
  const { height } = useWindowDimensions();
  return [styles.question, height < 760 && styles.questionCompact, { color: color.inkMuted }];
}

/** Flicky's art window: the coin at rest, the bull on an upward lean, the bear on a downward one, four screws. */
function ArtWindow({ compact }: { compact: boolean }) {
  const { color } = useTheme();
  const lean = useLean();
  const { reducedMotion } = useStageFeel();
  const lift = lean && !reducedMotion ? { transform: [{ scale: 1.18 }, { rotate: lean === "up" ? "-4deg" : "4deg" }] } : null;
  const size = compact ? 72 : 88;
  return (
    <View
      style={[styles.art, { height: compact ? 104 : 132, borderColor: color.hairline, backgroundColor: color.ground }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <View key={corner} style={[styles.screw, SCREW[corner], { backgroundColor: color.shadow }]} />
      ))}
      <View style={lift}>
        {lean === "up" ? <BullMark size={size} /> : lean === "down" ? <BearMark size={size} /> : <CoinMark size={size} />}
      </View>
    </View>
  );
}

function Clock({ text, ink, pulse }: { text: string; ink: string; pulse: boolean }) {
  const { reducedMotion } = useStageFeel();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (pulse && !reducedMotion) {
      glow.value = withRepeat(withTiming(0.55, { duration: 400 }), -1, true);
    } else {
      cancelAnimation(glow);
      glow.value = 1;
    }
  }, [pulse, reducedMotion, glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={[styles.clock, style]} accessibilityRole="timer" accessibilityLabel={text}>
      <SymbolView name={{ ios: "clock", android: "schedule" }} size={13} tintColor={ink} />
      <Text style={[styles.clockText, { color: ink }]}>{text.toUpperCase()}</Text>
    </Animated.View>
  );
}

const SCREW = {
  tl: { top: 4, left: 4 },
  tr: { top: 4, right: 4 },
  bl: { bottom: 4, left: 4 },
  br: { bottom: 4, right: 4 },
} as const;

const styles = StyleSheet.create({
  band: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  title: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10 },
  titleAsset: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  pixelLg: { fontFamily: FONT.dataStrong, fontSize: 14, letterSpacing: 1.8 },
  pixelSm: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 0.6 },
  cadence: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: StyleSheet.hairlineWidth },
  place: { marginLeft: "auto", fontVariant: ["tabular-nums"] },
  art: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  screw: { position: "absolute", width: 6, height: 6, opacity: 0.5 },
  quote: { gap: 4, paddingVertical: 10, paddingHorizontal: 12 },
  quoteInset: { position: "absolute", top: 4, left: 4, right: 4, bottom: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 7 },
  eyebrow: { fontFamily: FONT.data, fontSize: 12, letterSpacing: 2.6, opacity: 0.85 },
  question: { fontFamily: FONT.headingHeavy, fontSize: 26, lineHeight: 28, letterSpacing: -0.5 },
  questionCompact: { fontSize: 22, lineHeight: 25 },
  clock: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  clockText: { fontFamily: FONT.data, fontSize: 12, letterSpacing: 2, fontVariant: ["tabular-nums"] },
  pills: { flexDirection: "row", gap: 8 },
  pill: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 6, paddingHorizontal: 10 },
  pillKey: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 2 },
  pillValue: { fontFamily: FONT.dataStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
});
