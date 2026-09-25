import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { RANGE } from "@/features/range/copy";
import { usdOnGrid } from "@/features/range/format";
import type { RangeDraft } from "@/features/range/useRangeDraft";
import { haptic } from "~/components/kit";
import { useRangeTokens } from "./PageParts";

interface Props {
  asset: string;
  draft: RangeDraft;
  /** The live price on the band's grid: the tick and dot on the axis. */
  marketUsd: number;
  onDragging: (dragging: boolean) => void;
}

/**
 * range-band.css `.rg-track` (32 tall, 12 in from the card's edges): the axis hairline, the band as one draggable
 * thumb — its 8 px vermilion-washed fill edged in vermilion, the three-line grip — and the live price as a tick and
 * dot. Dragging moves the centre on the asset's grid (web's pointer drag, for a finger); each grid step is a detent.
 * VoiceOver gets web's slider semantics: increment and decrement step the centre.
 */
export function BandTrack({ asset, draft, marketUsd, onDragging }: Props) {
  const { r, color } = useRangeTokens();
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(0);
  const { spotUsd, lowUsd, highUsd, offset, centerMax, axisHalf, unit, decimals } = draft;
  useEffect(() => {
    if (dragging) haptic.select();
  }, [offset, dragging]);
  if (spotUsd === null || lowUsd === null || highUsd === null) return null;

  const pct = (v: number) => Math.max(0, Math.min(1, (v - (spotUsd - axisHalf)) / (axisHalf * 2)));
  const usdPerPt = width > 0 ? (axisHalf * 2) / width : 0;
  const begin = () => {
    start.current = offset;
    setDragging(true);
    onDragging(true);
  };
  const end = () => {
    setDragging(false);
    onDragging(false);
  };
  const move = (dx: number) => draft.setOffset(start.current + dx * usdPerPt);
  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onBegin(() => runOnJS(begin)())
    .onUpdate((e) => runOnJS(move)(e.translationX))
    .onFinalize(() => runOnJS(end)());

  const usd = (n: number) => usdOnGrid(n, decimals);
  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") draft.nudge(1);
    else if (event.nativeEvent.actionName === "decrement") draft.nudge(-1);
  };
  const left = pct(lowUsd) * width;
  const right = pct(highUsd) * width;
  const dot = pct(marketUsd) * width;

  return (
    <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.line, { backgroundColor: r.trackLine }]} />
      {width > 0 ? (
        <>
          <GestureDetector gesture={pan}>
            <View
              style={[styles.thumb, { left, width: Math.max(0, right - left) }]}
              hitSlop={{ top: 8, bottom: 8 }}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={RANGE.band.sliderLabel(asset)}
              accessibilityValue={{ min: -centerMax, max: centerMax, now: offset, text: offset === 0 ? RANGE.band.sliderCentered : RANGE.band.sliderOff(usd(Math.abs(offset)), offset > 0) }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={onAction}
              accessibilityHint={`${RANGE.band.drag}. ${usd(unit)} a step.`}
            >
              <View style={[styles.fill, { borderColor: color.accent, backgroundColor: dragging ? r.thumbFillDrag : r.thumbFill }]} />
              <View style={styles.grip} pointerEvents="none">
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.gripLine, { backgroundColor: r.grip }]} />
                ))}
              </View>
            </View>
          </GestureDetector>
          <View pointerEvents="none" style={[styles.tick, { left: dot, backgroundColor: r.spotTick }]} />
          <View pointerEvents="none" style={[styles.dot, { left: dot - 3, backgroundColor: r.spotDot }]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { position: "relative", marginHorizontal: 12, height: 32 },
  line: { position: "absolute", left: 0, right: 0, top: 16, height: 1 },
  thumb: { position: "absolute", top: 4, height: 24, borderRadius: 2, zIndex: 10, justifyContent: "center" },
  fill: { position: "absolute", left: 0, right: 0, top: 8, height: 8, borderRadius: 2, borderLeftWidth: 1, borderRightWidth: 1 },
  grip: { flexDirection: "row", gap: 1, alignSelf: "center" },
  gripLine: { width: 1, height: 10 },
  tick: { position: "absolute", top: 10, height: 12, width: 1, zIndex: 20 },
  dot: { position: "absolute", top: 13, height: 6, width: 6, borderRadius: 9999, zIndex: 20 },
});
