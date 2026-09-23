import { aimToCall, callToAim, MOONSHOT_AIM_LADDER, type MoonshotAim, type MoonshotCall } from "@agari/core/range";
import { SymbolView } from "expo-symbols";
import { useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { MOONSHOT } from "@/features/games/moonshot/copy";
import { usePersistedState } from "@/lib/persisted";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { useGames } from "~/features/games/shell";

/** web's `useRememberedCall` (AimControl.tsx): the aim under Pips' key, LONG ×5 by default. */
const AIM_KEY = "agari.games.moonshot.aim";
const DEFAULT_AIM: MoonshotAim = 5;
const LAST = MOONSHOT_AIM_LADDER.length - 1;
const RUNG_H = 44;
const MID_H = 10;
/** Deepest LONG at the top, deepest SHORT at the bottom — the knob's own order, read top down. */
const ORDER: readonly MoonshotAim[] = [...MOONSHOT_AIM_LADDER].reverse();

const aimCodec = {
  parse: (raw: string): MoonshotAim | null => {
    const n = Number(raw);
    return (MOONSHOT_AIM_LADDER as readonly number[]).includes(n) ? (n as MoonshotAim) : null;
  },
  serialize: (aim: MoonshotAim) => String(aim),
};

export function useRememberedCall(): [MoonshotCall, (call: MoonshotCall) => void] {
  const [aim, setAim] = usePersistedState<MoonshotAim>(AIM_KEY, DEFAULT_AIM, aimCodec);
  const setCall = useCallback((call: MoonshotCall) => setAim(callToAim(call)), [setAim]);
  return [aimToCall(aim), setCall];
}

/** Which rung a finger at `y` (points from the ladder's top) is on. */
function rungAt(y: number): MoonshotAim {
  const longs = ORDER.filter((a) => a > 0).length;
  const row = y < longs * RUNG_H ? Math.floor(y / RUNG_H) : Math.floor((y - MID_H) / RUNG_H);
  return ORDER[Math.max(0, Math.min(ORDER.length - 1, row))] as MoonshotAim;
}

/**
 * web's `moonshot/AimControl.tsx` (Pips' AIM knob) as a touch ladder: ten rungs, the sign is the side and the distance
 * the reach. Tap a rung, or hold and slide and the aim follows the finger, a detent per rung (a plain swipe still
 * scrolls the page). The flip sting fires only when the side crosses the middle. VoiceOver adjusts it like a slider.
 */
export function AimLadder({ call, onCall, disabled }: { call: MoonshotCall; onCall: (call: MoonshotCall) => void; disabled?: boolean }) {
  const { color } = useTheme();
  const { feedback: cue } = useGames();
  const words = MOONSHOT.aim;
  const aim = callToAim(call);
  const index = MOONSHOT_AIM_LADDER.indexOf(aim);
  const current = useRef(aim);
  current.current = aim;

  const set = useCallback(
    (next: MoonshotAim) => {
      const was = current.current;
      if (disabled || next === was) return;
      if (next > 0 !== was > 0) cue(next > 0 ? "swipe-up" : "swipe-down");
      else haptic.select();
      current.current = next;
      onCall(aimToCall(next));
    },
    [disabled, onCall, cue],
  );
  const step = (by: number) => {
    const next = MOONSHOT_AIM_LADDER[Math.max(0, Math.min(LAST, index + by))];
    if (next !== undefined) set(next);
  };
  const follow = (y: number) => set(rungAt(y));

  const pan = Gesture.Pan()
    .enabled(!disabled)
    // Hold, then slide: a plain vertical swipe over the ladder still scrolls the page.
    .activateAfterLongPress(160)
    .onStart((e) => runOnJS(follow)(e.y))
    .onUpdate((e) => runOnJS(follow)(e.y));

  const onAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") step(1);
    else if (event.nativeEvent.actionName === "decrement") step(-1);
  };
  const long = call.direction === "long";
  const ink = long ? color.profit : color.loss;

  const rung = (value: MoonshotAim) => {
    const on = value === aim;
    const isLong = value > 0;
    const tone = isLong ? color.profit : color.loss;
    return (
      <Pressable
        key={value}
        onPress={() => set(value)}
        importantForAccessibility="no"
        accessibilityElementsHidden
        style={[styles.rung, { backgroundColor: on ? tone : "transparent", borderColor: on ? tone : color.hairline }]}
      >
        <Text style={[styles.rungSide, { color: on ? color.ground : tone }]}>{isLong ? "L" : "S"}</Text>
        <Text style={[styles.rungX, { color: on ? color.ground : color.ink }]}>{words.rung(Math.abs(value))}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{words.label}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.must}</Text>
      </View>
      <View style={styles.body}>
        <GestureDetector gesture={pan}>
          <View
            style={styles.ladder}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={words.ladder}
            accessibilityValue={{ text: words.valueText(call.direction, call.multiple) }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={onAction}
          >
            {ORDER.filter((a) => a > 0).map(rung)}
            <View style={styles.mid}>
              <View style={[styles.midLine, { backgroundColor: color.borderStrong }]} />
            </View>
            {ORDER.filter((a) => a < 0).map(rung)}
          </View>
        </GestureDetector>
        <View style={styles.readout} accessibilityLiveRegion="polite">
          <Text style={[styles.readoutX, { color: ink }]}>{words.rung(call.multiple)}</Text>
          <Text style={[TYPE.labelMicro, { color: ink }]}>{long ? words.long : words.short}</Text>
          <SymbolView name={long ? { ios: "arrow.up.forward", android: "north_east" } : { ios: "arrow.down.forward", android: "south_east" }} size={28} tintColor={ink} />
          <Text style={[TYPE.caption, styles.hint, { color: color.inkMuted }]}>{words.hint}</Text>
          <View style={styles.btns}>
            <StepButton up label={words.up} disabled={disabled || index === LAST} onPress={() => step(1)} />
            <StepButton up={false} label={words.down} disabled={disabled || index === 0} onPress={() => step(-1)} />
          </View>
        </View>
      </View>
    </View>
  );
}

function StepButton({ up, label, disabled, onPress }: { up: boolean; label: string; disabled?: boolean; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.step, { borderColor: color.hairline, backgroundColor: pressed ? color.surface2 : color.surface1, opacity: disabled ? 0.4 : 1 }]}
    >
      <SymbolView name={up ? { ios: "chevron.up", android: "expand_less" } : { ios: "chevron.down", android: "expand_more" }} size={18} tintColor={color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  head: { gap: 2 },
  body: { flexDirection: "row", gap: 14 },
  ladder: { flex: 1.1 },
  rung: { height: RUNG_H - 4, marginVertical: 2, borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  rungSide: { fontFamily: FONT.dataStrong, fontSize: 12, letterSpacing: 1 },
  rungX: { fontFamily: FONT.dataStrong, fontSize: 16 },
  mid: { height: MID_H, justifyContent: "center" },
  midLine: { height: 2, borderRadius: 1 },
  readout: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  readoutX: { fontFamily: FONT.dataStrong, fontSize: 56, lineHeight: 62, fontVariant: ["tabular-nums"] },
  hint: { textAlign: "center" },
  btns: { flexDirection: "row", gap: 8, marginTop: 6 },
  step: { width: 48, height: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
