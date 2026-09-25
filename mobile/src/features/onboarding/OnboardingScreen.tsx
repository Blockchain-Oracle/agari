import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, haptic } from "~/components/kit";
import { storage } from "~/lib/storage";
import { FONT, useTheme } from "~/theme";
import { BrandIntro } from "./BrandIntro";
import { ONBOARDING_PAGES, ONBOARDING_UI, type OnboardingPage } from "./onboarding-copy";
import { playOnboarding, preloadOnboardingSounds, releaseOnboardingSounds } from "./onboarding-sound";
import { OnboardingVisual } from "./OnboardingVisuals";

/** This install has been onboarded; web's tutorial key is set too, so its first-run card never follows this. */
export const ONBOARDED_KEY = "agari.mobile.onboarded.v1";
const LAST = ONBOARDING_PAGES.length - 1;

/** The title's words rise in one after another (21st "Words Stagger": 0.1 s apart, up and in). */
function StaggerTitle({ page, active }: { page: OnboardingPage; active: boolean }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const words = [...page.title.split(" ").map((w) => ({ w, accent: false })), ...page.accent.split(" ").map((w) => ({ w, accent: true }))];
  // Re-keyed on activation, so each arrival on a page plays its reveal again.
  return (
    <Text style={styles.title} accessibilityRole="header" key={active ? "on" : "off"}>
      {words.map(({ w, accent }, i) => (
        <Animated.Text
          key={`${w}-${i}`}
          entering={reduce || !active ? undefined : FadeInDown.delay(120 + i * 70).duration(420).easing(Easing.out(Easing.cubic))}
          style={{ color: accent ? color.accent : color.ink }}
        >
          {`${w}${i < words.length - 1 ? " " : ""}`}
        </Animated.Text>
      ))}
    </Text>
  );
}

/** One page: the visual rides slower than the swipe (parallax) and settles in scale; the words ride with it. */
function Page({ page, index, width, scrollX, active }: { page: OnboardingPage; index: number; width: number; scrollX: SharedValue<number>; active: boolean }) {
  const { color } = useTheme();
  const visual = useAnimatedStyle(() => {
    const d = scrollX.value / width - index;
    return {
      opacity: interpolate(d, [-1, 0, 1], [0, 1, 0]),
      transform: [{ translateX: interpolate(d, [-1, 0, 1], [width * 0.45, 0, -width * 0.45]) }, { scale: interpolate(d, [-1, 0, 1], [0.86, 1, 0.86]) }],
    };
  });
  const words = useAnimatedStyle(() => {
    const d = scrollX.value / width - index;
    return { opacity: interpolate(d, [-0.6, 0, 0.6], [0, 1, 0]), transform: [{ translateX: interpolate(d, [-1, 0, 1], [width * 0.18, 0, -width * 0.18]) }] };
  });
  return (
    <View style={[styles.page, { width }]}>
      <Animated.View style={[styles.visual, visual]}>
        <OnboardingVisual page={page.key} />
      </Animated.View>
      <Animated.View style={[styles.copy, words]}>
        <Text style={[styles.eyebrow, { color: color.accent }]}>{page.eyebrow}</Text>
        <StaggerTitle page={page} active={active} />
        <Text style={[styles.body, { color: color.inkSecondary }]}>{page.body}</Text>
      </Animated.View>
    </View>
  );
}

/**
 * The app's first run (S26, 09-25), before anything else: the brand intro, then four pages that swipe (or step with
 * Next) under a progress rule, each page turn a tick and a selection tap, the last one ending on Connect or Look around.
 */
export function OnboardingScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [intro, setIntro] = useState(true);
  const [index, setIndex] = useState(0);
  const list = useAnimatedRef<Animated.FlatList<OnboardingPage>>();
  const scrollX = useSharedValue(0);
  const ended = useRef(false);

  useEffect(() => {
    preloadOnboardingSounds();
    return releaseOnboardingSounds;
  }, []);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next === index) return;
    setIndex(next);
    playOnboarding("page");
    haptic.select();
  };
  const goTo = (next: number) => {
    list.current?.scrollToOffset({ offset: next * width, animated: true });
    setIndex(next);
    playOnboarding("page");
    haptic.select();
  };

  const finish = useCallback((then: "connect" | "browse") => {
    if (ended.current) return;
    ended.current = true;
    storage.set(ONBOARDED_KEY, true);
    globalThis.localStorage?.setItem("agari.tutorialSeen", "1");
    playOnboarding("done");
    haptic.success();
    router.replace("/markets");
    if (then === "connect") setTimeout(() => router.push("/connect"), 350);
  }, []);

  const progress = useAnimatedStyle(() => ({ width: `${Math.min(100, ((scrollX.value / width + 1) / ONBOARDING_PAGES.length) * 100)}%` }));
  const last = index === LAST;

  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Text style={[styles.step, { color: color.inkMuted }]}>{ONBOARDING_UI.progress(index + 1, ONBOARDING_PAGES.length)}</Text>
        {last ? null : (
          <Pressable onPress={() => finish("browse")} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.skip, { color: color.inkSecondary }]}>{ONBOARDING_UI.skip}</Text>
          </Pressable>
        )}
      </View>
      <View style={[styles.track, { backgroundColor: color.hairline }]}>
        <Animated.View style={[styles.bar, { backgroundColor: color.accent }, progress]} />
      </View>

      <Animated.FlatList
        ref={list}
        data={ONBOARDING_PAGES}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        renderItem={({ item, index: i }) => <Page page={item} index={i} width={width} scrollX={scrollX} active={!intro && i === index} />}
        style={styles.fill}
      />

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {last ? (
          <Animated.View entering={FadeIn.duration(260)} style={styles.actions}>
            <Button label={ONBOARDING_UI.connect} variant="primary" size="lg" onPress={() => finish("connect")} />
            <Button label={ONBOARDING_UI.browse} variant="ghost" size="lg" onPress={() => finish("browse")} />
          </Animated.View>
        ) : (
          <Button label={ONBOARDING_UI.next} variant="primary" size="lg" trailing="→" onPress={() => goTo(index + 1)} />
        )}
      </View>

      {intro ? <BrandIntro onDone={() => setIntro(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, height: 44 },
  step: { fontFamily: FONT.dataRegular, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  skip: { fontFamily: FONT.bodyMedium, fontSize: 15 },
  track: { height: 2, marginHorizontal: 20, borderRadius: 1, overflow: "hidden" },
  bar: { height: 2, borderRadius: 1 },
  page: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 22 },
  visual: { flex: 1, justifyContent: "center" },
  copy: { gap: 12 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 34, lineHeight: 38, letterSpacing: -1.2 },
  body: { fontFamily: FONT.body, fontSize: 15, lineHeight: 23 },
  foot: { paddingHorizontal: 20, paddingTop: 12 },
  actions: { gap: 8 },
});
