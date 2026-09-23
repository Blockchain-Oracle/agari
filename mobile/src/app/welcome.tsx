import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { TUTORIAL_STEPS, TUTORIAL_UI } from "@/features/onboarding/steps";
import { Button, haptic } from "~/components/kit";
import { AgariMark } from "~/components/shell/AgariMark";
import { ThemeToggle } from "~/components/shell/ThemeToggle";
import { LiveWindowPreview } from "~/features/onboarding/LiveWindowPreview";
import { PoolsArt, WalletsArt, WindowTimeline } from "~/features/onboarding/StepArt";
import { storage } from "~/lib/storage";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** This install has seen the walkthrough; web's own key is set too, so web code reading it agrees. */
const ONBOARDED_KEY = "agari.mobile.onboarded.v1";

const ART = [LiveWindowPreview, WindowTimeline, WalletsArt, PoolsArt] as const;

/**
 * web's first-run Tutorial (features/onboarding, five steps in its order and words) as a swipeable phone walkthrough:
 * what this is (with a real live Window), how a Window works, who signs, where money sits, and connecting.
 */
export default function WelcomeScreen() {
  const { color } = useTheme();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [step, setStep] = useState(0);
  const last = step === TUTORIAL_STEPS.length - 1;

  const finish = (connect: boolean) => {
    storage.set(ONBOARDED_KEY, true);
    globalThis.localStorage?.setItem("agari.tutorialSeen", "1");
    haptic.tap();
    router.replace("/markets");
    if (connect) setTimeout(() => router.push("/connect"), 0);
  };
  const goTo = (index: number) => {
    haptic.select();
    pager.current?.scrollTo({ x: index * width, animated: true });
    setStep(index);
  };
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    if (index !== step) {
      haptic.select();
      setStep(index);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: color.ground }]}>
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <AgariMark width={22} height={22} />
          <Text style={[styles.brandText, { color: color.ink }]}>AGARI</Text>
        </View>
        <View style={styles.topRight}>
          <Text style={[TYPE.data, { color: color.inkMuted }]}>{TUTORIAL_UI.progress(step + 1, TUTORIAL_STEPS.length)}</Text>
          <ThemeToggle />
        </View>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        accessibilityRole="adjustable"
        accessibilityLabel={TUTORIAL_UI.progress(step + 1, TUTORIAL_STEPS.length)}
      >
        {TUTORIAL_STEPS.map((entry, index) => {
          const Art = ART[index];
          return (
            <ScrollView key={entry.title} style={{ width }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
              <Text style={[styles.kicker, { color: color.accent }]}>{String(index + 1).padStart(2, "0")} · SOLANA DEVNET</Text>
              <Text style={[TYPE.display, styles.title, { color: color.ink }]} accessibilityRole="header">
                {entry.title}
              </Text>
              <View style={[styles.rule, { backgroundColor: color.accent }]} />
              <Text style={[TYPE.body, { color: color.inkSecondary }]}>{entry.description}</Text>
              {Art ? <Art /> : null}
              {entry.choice ? (
                <View style={[styles.connect, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
                  <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{TUTORIAL_UI.lastStep}</Text>
                  <Text style={[TYPE.title, { color: color.ink }]}>{TUTORIAL_UI.connectTitle}</Text>
                  <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{TUTORIAL_UI.connectNote}</Text>
                </View>
              ) : null}
            </ScrollView>
          );
        })}
      </ScrollView>

      <View style={[styles.actions, { borderTopColor: color.hairline }]}>
        <View style={styles.dots}>
          {TUTORIAL_STEPS.map((entry, index) => (
            <Dot key={entry.title} active={index === step} onPress={() => goTo(index)} label={TUTORIAL_UI.progress(index + 1, TUTORIAL_STEPS.length)} />
          ))}
        </View>
        {last ? (
          <>
            <Button label="Connect a wallet" size="lg" onPress={() => finish(true)} />
            <Button label="Explore markets first" variant="secondary" onPress={() => finish(false)} />
          </>
        ) : (
          <>
            <Button label={TUTORIAL_UI.next} size="lg" trailing="→" onPress={() => goTo(step + 1)} />
            <Pressable onPress={() => finish(false)} accessibilityRole="button" style={styles.skip}>
              <Text style={[TYPE.bodyStrong, { color: color.inkMuted }]}>{TUTORIAL_UI.skip}</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function Dot({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  const { color } = useTheme();
  const style = useAnimatedStyle(() => ({ width: withSpring(active ? 24 : 7, { damping: 16 }) }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      <Animated.View style={[styles.dot, { backgroundColor: active ? color.accent : color.borderStrong }, style]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topbar: { height: 56, paddingHorizontal: SPACE.gutter + 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontFamily: FONT.headingHeavy, fontSize: 16, letterSpacing: 2 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  page: { paddingHorizontal: SPACE.gutter + 4, paddingTop: 18, paddingBottom: 24, gap: 14 },
  kicker: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 2 },
  title: { fontSize: 36, lineHeight: 40 },
  rule: { width: 56, height: 3, borderRadius: RADIUS.sm },
  connect: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACE.gutter + 4, paddingTop: 14, paddingBottom: 6, gap: 8 },
  dots: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  dot: { height: 7, borderRadius: 4 },
  skip: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
