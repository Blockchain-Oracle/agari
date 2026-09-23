import { DEVNET_WALLET_STEP } from "@agari/core/copy";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { Button } from "~/components/kit";
import { Logo } from "~/components/logos/Logo";
import type { BrandLogo } from "~/components/logos/brand-logos";
import { RADIUS, TYPE, useTheme } from "~/theme";

const MARK = 76;

/** 21st: "Breathe Ring" (id 28403) — two rings breathing out of the wallet's mark while the wallet app has the turn. */
function BreatheRing({ delayMs }: { delayMs: number }) {
  const { color } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delayMs, withRepeat(withTiming(1, { duration: 1_800, easing: Easing.out(Easing.quad) }), -1, false));
  }, [t, delayMs]);
  const style = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.7 }] }));
  return <Animated.View style={[styles.ring, { borderColor: color.accent }, style]} />;
}

/**
 * The hand-off: Agari has sent the person to their wallet app and is waiting for it to send them back. Says which app,
 * what to do there, the one setting that makes a devnet request fail (the wallet on mainnet), and a way out.
 */
export function Handoff({ name, logo, stage, error, onCancel, onRetry }: {
  name: string;
  logo: BrandLogo | null;
  stage: "opening" | "waiting" | "failed";
  error: string | null;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const headline = stage === "failed" ? `${name} did not connect` : stage === "opening" ? `Opening ${name}…` : `Approve in ${name}`;
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.stage}>
        {stage !== "failed" && !reduce ? (
          <>
            <BreatheRing delayMs={0} />
            <BreatheRing delayMs={900} />
          </>
        ) : null}
        <View style={[styles.mark, { borderColor: stage === "failed" ? color.loss : color.hairline, backgroundColor: color.surface1 }]}>
          {logo ? <Logo brand={logo} size={MARK - 12} radius={RADIUS.lg} /> : null}
        </View>
      </View>
      <Text style={[TYPE.headline, styles.center, { color: color.ink }]}>{headline}</Text>
      {stage === "failed" ? (
        <Text style={[TYPE.body, styles.center, { color: color.loss }]}>{error ?? "The wallet did not return an answer."}</Text>
      ) : (
        <Text style={[TYPE.body, styles.center, { color: color.inkSecondary }]}>
          {name} asks you to connect to Agari on Solana devnet. Approve it there and you come straight back here.
        </Text>
      )}
      <View style={[styles.tip, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>If it says “network mismatch”</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{DEVNET_WALLET_STEP}</Text>
      </View>
      <View style={styles.actions}>
        {stage === "failed" ? <Button label="Try again" onPress={onRetry} /> : null}
        <Button label={stage === "failed" ? "Choose another wallet" : "Cancel"} variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 14, paddingTop: 12 },
  stage: { width: MARK * 2, height: MARK * 2, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: MARK, height: MARK, borderRadius: RADIUS.xl, borderWidth: 2 },
  mark: { width: MARK, height: MARK, borderRadius: RADIUS.xl, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  center: { textAlign: "center" },
  tip: { alignSelf: "stretch", borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  actions: { alignSelf: "stretch", gap: 10 },
});
