import { aimToCall, callToAim, MOONSHOT_AIM_LADDER, type MoonshotAim, type MoonshotCall } from "@agari/core/range";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MOONSHOT } from "@/features/games/moonshot/copy";
import { usePersistedState } from "@/lib/persisted";
import { haptic } from "~/components/kit";
import { useGames } from "~/features/games/shell";
import { FONT } from "~/theme";
import { IconBtn } from "../range/BandControl";
import { useRangeTokens } from "../range/PageParts";

/** web's `useRememberedCall` (AimControl.tsx): the aim under Pips' key, LONG ×5 by default. */
const AIM_KEY = "agari.games.moonshot.aim";
const DEFAULT_AIM: MoonshotAim = 5;
const LAST = MOONSHOT_AIM_LADDER.length - 1;
/** Deepest LONG at the ceiling, deepest SHORT at the floor — the knob's own order, read top down. */
const LONG_RUNGS = [...MOONSHOT_AIM_LADDER].filter((aim) => aim > 0).reverse();
const SHORT_RUNGS = [...MOONSHOT_AIM_LADDER].filter((aim) => aim < 0).reverse();

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

/**
 * web's `moonshot/AimControl.tsx` (moonshot.css): Pips' AIM knob as a ladder of ten rungs — the sign is the side and
 * the distance the reach — beside the readout (the reach large, the side, the hint and the two steps). The flip
 * sting fires only when the side crosses the middle; a step within a side is the control's own click.
 */
export function AimLadder({ call, onCall, disabled }: { call: MoonshotCall; onCall: (call: MoonshotCall) => void; disabled?: boolean }) {
  const { r, color } = useRangeTokens();
  const { feedback } = useGames();
  const words = MOONSHOT.aim;
  const aim = callToAim(call);
  const index = MOONSHOT_AIM_LADDER.indexOf(aim);

  const set = useCallback(
    (next: number) => {
      const nextAim = MOONSHOT_AIM_LADDER[Math.max(0, Math.min(LAST, next))];
      if (nextAim === undefined || nextAim === aim) return;
      if (nextAim > 0 !== aim > 0) feedback(nextAim > 0 ? "swipe-up" : "swipe-down");
      onCall(aimToCall(nextAim));
    },
    [aim, onCall, feedback],
  );

  const rung = (value: MoonshotAim) => {
    const on = value === aim;
    const long = value > 0;
    const onGround = long ? { borderColor: r.longOnBorder, backgroundColor: r.longOnBg } : { borderColor: r.shortOnBorder, backgroundColor: r.shortOnBg };
    return (
      <Pressable
        key={value}
        onPress={() => {
          haptic.select();
          set(MOONSHOT_AIM_LADDER.indexOf(value));
        }}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ checked: on, disabled: !!disabled }}
        accessibilityLabel={words.valueText(long ? "long" : "short", Math.abs(value))}
        style={({ pressed }) => [styles.rung, { borderColor: r.rungBorder }, on && onGround, disabled && styles.off, pressed && styles.pressed]}
      >
        <Text style={[styles.rungSide, { color: long ? color.profit : color.loss, opacity: on ? 1 : 0.7 }]}>{long ? "L" : "S"}</Text>
        <Text style={[styles.rungX, { color: on ? color.ink : r.rungInk }]}>{words.rung(Math.abs(value))}</Text>
      </Pressable>
    );
  };

  const long = call.direction === "long";
  const ink = long ? color.profit : color.loss;
  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.label, { color: r.bandLabel }]}>{words.label.toUpperCase()}</Text>
        <Text style={[styles.must, { color: r.bandMust }]}>{words.must}</Text>
      </View>
      <View style={[styles.body, { borderColor: r.bandBorder, backgroundColor: r.bandBg }]}>
        <View style={styles.ladder} accessibilityRole="radiogroup" accessibilityLabel={words.ladder}>
          {LONG_RUNGS.map(rung)}
          <View style={[styles.mid, { backgroundColor: r.ladderMid }]} />
          {SHORT_RUNGS.map(rung)}
        </View>
        <View style={styles.readout} accessibilityLiveRegion="polite">
          <Text style={[styles.x, { color: color.accent }]}>{words.rung(call.multiple)}</Text>
          <Text style={[styles.side, { color: ink }]}>{(long ? words.long : words.short).toUpperCase()}</Text>
          <Text style={[styles.hint, { color: r.hint }]}>{words.hint.toUpperCase()}</Text>
          <View style={styles.btns}>
            <IconBtn Icon={ChevronUp} label={words.up} disabled={disabled || index === LAST} onPress={() => set(index + 1)} />
            <IconBtn Icon={ChevronDown} label={words.down} disabled={disabled || index === 0} onPress={() => set(index - 1)} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  label: { fontFamily: FONT.dataRegular, fontSize: 9, letterSpacing: 1.44 },
  must: { flexShrink: 1, textAlign: "right", fontFamily: FONT.dataRegular, fontSize: 8.5 },
  body: { flexDirection: "row", gap: 16, borderRadius: 6, borderWidth: 1, padding: 12 },
  ladder: { width: 104, gap: 3 },
  mid: { height: 1, marginVertical: 3, marginHorizontal: 4 },
  rung: { height: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1 },
  rungSide: { fontFamily: FONT.dataRegular, fontSize: 8, letterSpacing: 1.12 },
  rungX: { fontFamily: FONT.dataRegular, fontSize: 11, fontVariant: ["tabular-nums"] },
  off: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
  readout: { flex: 1, minWidth: 0 },
  x: { fontFamily: FONT.headingHeavy, fontSize: 40, lineHeight: 44, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  side: { marginTop: 6, fontFamily: FONT.dataStrong, fontSize: 11, letterSpacing: 1.54 },
  hint: { marginTop: 10, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5, letterSpacing: 0.72 },
  btns: { marginTop: "auto", paddingTop: 12, flexDirection: "row", gap: 4 },
});
