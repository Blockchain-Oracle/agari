import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { RANGE } from "@/features/range/copy";
import { usdOnGrid } from "@/features/range/format";
import { bandHalfUsd, RANGE_PRESETS, type RangePresetKey } from "@/features/range/presets";
import type { RangeDraft } from "@/features/range/useRangeDraft";
import { haptic } from "~/components/kit";
import { RADIUS, useTheme } from "~/theme";

const TRACK_H = 56;
const HANDLE = 30;

interface Props {
  asset: string;
  intervalSec: number;
  draft: RangeDraft;
  /** The live price on the band's grid: the dot and tick on the axis. */
  marketUsd: number;
  onDragging: (dragging: boolean) => void;
}

/**
 * web's BandControl track (`rg-track`) for a finger — 21st: arihantcodes/dual-range-slider's track, range fill and two
 * thumbs, ported to gesture-handler. The band body drags its centre along the price axis (web's drag, on the asset's
 * grid, clamped to the cadence's limit); the two edge handles widen or narrow it, snapping to web's three width
 * presets — the only widths the reserve's ticket offers. The live price sits on the axis as a dot. Each step on the
 * grid is a haptic detent. VoiceOver gets web's slider semantics: increment/decrement moves the centre one step.
 */
// 21st: arihantcodes_1f7b8c4d/dual-range-slider
export function BandTrack({ asset, intervalSec, draft, marketUsd, onDragging }: Props) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const start = useRef({ offset: 0, half: 0 });
  const dragging = useRef(false);
  const { spotUsd, lowUsd, highUsd, offset, centerMax, axisHalf, unit, decimals, half, preset } = draft;
  // A detent each time a drag lands the band on a new grid position or width (never when the price itself moves).
  useEffect(() => {
    if (dragging.current) haptic.select();
  }, [offset, preset]);
  if (spotUsd === null || lowUsd === null || highUsd === null) return null;

  const usdPerPt = width > 0 ? (axisHalf * 2) / width : 0;
  const pct = (v: number) => Math.max(0, Math.min(1, (v - (spotUsd - axisHalf)) / (axisHalf * 2)));
  const left = pct(lowUsd) * width;
  const right = pct(highUsd) * width;
  const dot = pct(marketUsd) * width;

  // JS-side handlers, called from the gesture worklets.
  const begin = () => {
    start.current = { offset, half };
    dragging.current = true;
    onDragging(true);
    haptic.select();
  };
  const end = () => {
    dragging.current = false;
    onDragging(false);
  };
  const moveCentre = (dx: number) => {
    draft.setOffset(start.current.offset + dx * usdPerPt);
  };
  const moveEdge = (dx: number, edge: "low" | "high") => {
    const wanted = start.current.half + (edge === "high" ? dx : -dx) * usdPerPt;
    let best: RangePresetKey = draft.preset;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const p of RANGE_PRESETS) {
      const gap = Math.abs(bandHalfUsd(p.key, intervalSec, spotUsd) - wanted);
      if (gap < bestGap) {
        best = p.key;
        bestGap = gap;
      }
    }
    if (best !== draft.preset) draft.setPreset(best);
  };

  const body = Gesture.Pan()
    .activeOffsetX([-6, 6]).failOffsetY([-14, 14])
    .onBegin(() => runOnJS(begin)())
    .onUpdate((e) => runOnJS(moveCentre)(e.translationX))
    .onFinalize(() => runOnJS(end)());
  const edge = (which: "low" | "high") =>
    Gesture.Pan()
      .activeOffsetX([-6, 6]).failOffsetY([-14, 14])
      .onBegin(() => runOnJS(begin)())
      .onUpdate((e) => runOnJS(moveEdge)(e.translationX, which))
      .onFinalize(() => runOnJS(end)());

  const usd = (n: number) => usdOnGrid(n, decimals);
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") draft.nudge(1);
    else if (event.nativeEvent.actionName === "decrement") draft.nudge(-1);
  };
  const valueText = offset === 0 ? RANGE.band.sliderCentered : RANGE.band.sliderOff(usd(Math.abs(offset)), offset > 0);

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.axis, { backgroundColor: color.hairline }]} />
      {width > 0 ? (
        <>
          <GestureDetector gesture={body}>
            <View
              style={[styles.band, { left, width: Math.max(right - left, HANDLE), backgroundColor: color.accentWash, borderColor: color.accent }]}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={RANGE.band.sliderLabel(asset)}
              accessibilityValue={{ min: -centerMax, max: centerMax, now: offset, text: valueText }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={onAction}
              accessibilityHint={`${RANGE.band.drag}. ${usd(unit)} a step.`}
            >
              <View style={styles.grip}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.gripLine, { backgroundColor: color.accent }]} />
                ))}
              </View>
            </View>
          </GestureDetector>
          <GestureDetector gesture={edge("low")}>
            <View style={[styles.handle, { left: left - HANDLE / 2 }]} accessibilityLabel={RANGE.band.width} accessibilityElementsHidden importantForAccessibility="no">
              <View style={[styles.knob, { backgroundColor: color.ink, borderColor: color.accent }]} />
            </View>
          </GestureDetector>
          <GestureDetector gesture={edge("high")}>
            <View style={[styles.handle, { left: right - HANDLE / 2 }]} accessibilityElementsHidden importantForAccessibility="no">
              <View style={[styles.knob, { backgroundColor: color.ink, borderColor: color.accent }]} />
            </View>
          </GestureDetector>
          <View pointerEvents="none" style={[styles.tick, { left: dot - 1, backgroundColor: color.ink }]} />
          <View pointerEvents="none" style={[styles.dot, { left: dot - 5, backgroundColor: color.ink, borderColor: color.ground }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: TRACK_H, justifyContent: "center", marginHorizontal: HANDLE / 2 },
  axis: { height: 2, borderRadius: 1 },
  band: { position: "absolute", top: 8, bottom: 8, borderRadius: RADIUS.md, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  grip: { flexDirection: "row", gap: 3 },
  gripLine: { width: 2, height: 14, borderRadius: 1, opacity: 0.8 },
  handle: { position: "absolute", top: 0, bottom: 0, width: HANDLE, alignItems: "center", justifyContent: "center" },
  knob: { width: 12, height: 28, borderRadius: 6, borderWidth: 2 },
  tick: { position: "absolute", top: 2, bottom: 2, width: 2, opacity: 0.35 },
  dot: { position: "absolute", width: 10, height: 10, borderRadius: 5, borderWidth: 2, top: TRACK_H / 2 - 5 },
});
