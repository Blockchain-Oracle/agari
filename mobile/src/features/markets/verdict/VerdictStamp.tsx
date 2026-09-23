import { verdictStrings } from "@agari/core/copy";
import type { VerdictOutcome } from "@agari/core/types";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { haptic } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  outcome: VerdictOutcome;
  size?: "hero" | "compact";
  /** Press it with motion and a heavy haptic (the verdict moment); a list row passes false. */
  press?: boolean;
  /** Ink on the cream receipt paper instead of the page. */
  onPaper?: boolean;
}

/**
 * web's VerdictStamp: the kanji in Noto Serif JP with romaji and translation always beneath, so the verdict never
 * depends on reading Japanese or on colour. Colour law: vermilion belongs to the win alone; a loss is neutral ink, a
 * void muted. Pressed, it lands like a hanko — scale down onto the page, a heavy haptic, the ring inked round it.
 */
// 21st: dqnamo/signature (the self-drawing stroke, here the stamp's ring)
export function VerdictStamp({ outcome, size = "hero", press = false, onPaper = false }: Props) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const strings = verdictStrings(outcome);
  const hero = size === "hero";
  const ink = outcome === "win" ? color.accent : outcome === "loss" ? (onPaper ? color.creamInk : color.ink) : color.inkMuted;
  const ring = hero ? 118 : 60;
  const radius = ring / 2 - 3;
  const circumference = 2 * Math.PI * radius;

  const scale = useSharedValue(press && !reduce ? 1.7 : 1);
  const opacity = useSharedValue(press && !reduce ? 0 : 1);
  const drawn = useSharedValue(press && !reduce ? 0 : 1);

  useEffect(() => {
    if (!press) return;
    haptic.heavy();
    if (reduce) return;
    opacity.value = withTiming(1, { duration: 120 });
    scale.value = withSpring(1, { damping: 11, stiffness: 260, mass: 0.7 });
    drawn.value = withDelay(140, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [press, reduce, scale, opacity, drawn]);

  const stampStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }, { rotate: "-8deg" }] }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - drawn.value) }));

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={`${strings.romaji}, ${strings.translation}`}>
      <Animated.View style={[{ width: ring, height: ring }, styles.center, stampStyle]}>
        <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            stroke={ink}
            strokeWidth={hero ? 3 : 2}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={ringProps}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={[hero ? styles.kanjiHero : TYPE.stamp, { color: ink }]}>{strings.kanji}</Text>
      </Animated.View>
      <Text style={[TYPE.labelMicro, styles.sub, { color: onPaper ? color.creamInk : color.inkSecondary }]}>
        {strings.romaji} · {strings.translation}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-start", gap: 6 },
  center: { alignItems: "center", justifyContent: "center" },
  kanjiHero: { ...TYPE.stampHero, fontSize: 44, lineHeight: 50 },
  sub: { textTransform: "none", letterSpacing: 0.6 },
});
