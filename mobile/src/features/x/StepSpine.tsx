import { shortHex } from "@agari/core/units";
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { TRADE_FROM_X } from "@/features/x/copy";
import { FONT, useTheme } from "~/theme";
import { mixHex, tradeXTokens } from "~/theme/web/products/trade-x";
import { E_DRAW, E_EMPH, E_OUT, useLoop, useOnce } from "./motion";

export type StepState = "idle" | "active" | "done";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** web's StepSpine.tsx `Step`: a step on the focus-follows-step spine; the segment below fills once the flow passes it. */
export function Step({ n, title, state, spine, isLast, children }: {
  n: string; title: string; state: StepState; spine: { from: number; cur: number }; isLast?: boolean; children: ReactNode;
}) {
  const t = tradeXTokens(useTheme().name);
  const done = state === "done";
  const active = state === "active";
  const filled = spine.cur > spine.from;
  const fill = useRef(new Animated.Value(filled ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: filled ? 1 : 0, duration: 600, easing: E_EMPH, useNativeDriver: true }).start();
  }, [fill, filled]);
  return (
    <View style={[styles.step, isLast && styles.stepLast, state === "idle" && styles.idle]}>
      <View style={styles.rail}>
        <View>
          {active ? <Pulse /> : null}
          <View style={[styles.node, { borderColor: t.nodeBorder, backgroundColor: t.nodeBg }, done && { borderColor: t.nodeDoneBorder, backgroundColor: t.nodeDoneBg }, active && { borderColor: t.nodeActiveBorder, backgroundColor: t.nodeActiveBg }]}>
            {done ? <Tick /> : <Text style={[styles.nodeText, { color: active ? t.v : t.gray500 }]}>{n}</Text>}
          </View>
        </View>
        {!isLast ? (
          <View style={[styles.spine, { backgroundColor: t.spine }]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.spineFill, { backgroundColor: t.v, transform: [{ scaleY: fill }] }]} />
          </View>
        ) : null}
      </View>
      <View style={[styles.card, { borderColor: t.cardBorder, backgroundColor: t.cardBg }, done && { borderColor: t.cardDoneBorder, backgroundColor: t.cardDoneBg }, active && { borderColor: t.cardActiveBorder, backgroundColor: t.cardActiveBg }]}>
        <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

/** part-17.css `.xt-node-active` (xt-pulse 1.9s): a vermilion ring that spreads 9 px and fades. */
function Pulse() {
  const t = tradeXTokens(useTheme().name);
  const p = useLoop(1900, E_OUT);
  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [1, 54 / 36] });
  const opacity = p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return <Animated.View pointerEvents="none" style={[styles.pulse, { backgroundColor: t.pulse, opacity, transform: [{ scale }] }]} />;
}

/** web's `.xt-dot`: a 6 px mint (or vermilion) dot. */
export function Dot({ v }: { v?: boolean }) {
  const t = tradeXTokens(useTheme().name);
  return <View style={[styles.dot, { backgroundColor: v ? t.v : t.m }]} />;
}

/** web's `Tick` (`.xt-check`): the mint check, stroke drawn in over 0.42 s. */
export function Tick() {
  const t = tradeXTokens(useTheme().name);
  const draw = useOnce(420, 50, E_DRAW, false);
  const offset = draw.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <AnimatedPath d="M5 13l4 4L19 7" stroke={t.m} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" strokeDashoffset={offset} />
    </Svg>
  );
}

const ORB_WEDGES = 48;

/**
 * web's `IdentityChip`: the connected wallet with an orb whose conic gradient is seeded by the address itself
 * (`#${addr.slice(2, 8)}`). When those six characters are not hex, web's CSS drops the gradient and the orb is
 * empty; the port does the same.
 */
export function IdentityChip({ addr }: { addr: string }) {
  const t = tradeXTokens(useTheme().name);
  const seed = addr.slice(2, 8);
  const valid = /^[0-9a-fA-F]{6}$/.test(seed);
  const stops = [`#${seed}`, t.v, t.m, `#${seed}`];
  const wedges = valid
    ? Array.from({ length: ORB_WEDGES }, (_, i) => {
        const f = i / ORB_WEDGES;
        const seg = Math.min(2, Math.floor(f * 3));
        const colour = mixHex(stops[seg], stops[seg + 1], f * 3 - seg);
        const a0 = f * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1.05) / ORB_WEDGES) * Math.PI * 2 - Math.PI / 2;
        const d = `M12,12 L${12 + 12 * Math.cos(a0)},${12 + 12 * Math.sin(a0)} A12,12 0 0 1 ${12 + 12 * Math.cos(a1)},${12 + 12 * Math.sin(a1)} Z`;
        return <Path key={i} d={d} fill={colour} />;
      })
    : null;
  return (
    <View style={[styles.chip, { borderColor: t.chipBorder, backgroundColor: t.chipBg }]}>
      <View style={styles.orb}>
        <Svg width={24} height={24} viewBox="0 0 24 24">{wedges}</Svg>
      </View>
      <Text style={[styles.chipAddr, { color: t.gray200 }]}>{shortHex(addr)}</Text>
      <View style={styles.chipState}>
        <Dot />
        <Text style={[styles.chipStateText, { color: t.m }]}>{TRADE_FROM_X.connected}</Text>
      </View>
    </View>
  );
}

/** web's `ProofLink` (`.xt-proof`): a grey ↗ and the claim, opening the docs page that shows it. */
export function ProofLink({ onPress, children }: { onPress: () => void; children: string }) {
  const t = tradeXTokens(useTheme().name);
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={styles.proof}>
      {({ pressed }) => (
        <>
          <Text style={[styles.proofText, { color: pressed ? t.v : t.gray700 }]}>↗</Text>
          <Text style={[styles.proofText, styles.flex, { color: pressed ? t.v : t.gray500 }]}>{children}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 16, paddingBottom: 12 },
  stepLast: { paddingBottom: 0 },
  idle: { opacity: 0.4 },
  rail: { alignItems: "center" },
  node: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  nodeText: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
  pulse: { position: "absolute", top: 0, left: 0, width: 36, height: 36, borderRadius: 18 },
  spine: { width: 1, flex: 1, marginVertical: 6, overflow: "hidden" },
  spineFill: { transformOrigin: "top" },
  card: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 12 },
  title: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24, marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 9999, borderWidth: 1, paddingTop: 6, paddingBottom: 6, paddingLeft: 6, paddingRight: 14 },
  orb: { width: 24, height: 24, borderRadius: 12, overflow: "hidden" },
  chipAddr: { fontFamily: FONT.dataRegular, fontSize: 12.5, lineHeight: 20 },
  chipState: { flexDirection: "row", alignItems: "center", gap: 4 },
  chipStateText: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  proof: { flexDirection: "row", alignItems: "center", gap: 8 },
  proofText: { fontFamily: FONT.dataRegular, fontSize: 11.5, lineHeight: 18.4 },
  flex: { flex: 1 },
});
