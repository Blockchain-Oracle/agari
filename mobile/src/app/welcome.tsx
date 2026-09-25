import { BlurView } from "expo-blur";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { haptic } from "~/components/kit";
import { TutorialCard } from "~/features/onboarding/TutorialCard";
import { storage } from "~/lib/storage";
import { useTheme } from "~/theme";
import { activityTokens } from "~/theme/web/portfolio-activity";

/** This install has seen the walkthrough; web's own key is set too, so web code reading it agrees. */
const ONBOARDED_KEY = "agari.mobile.onboarded.v1";

/**
 * `/welcome` — web's first run is not a page: it is the Tutorial dialog (features/onboarding/Tutorial.tsx) over the
 * live markets. So this route is that dialog: web's `.tutorial-scrim` (black/70, a 4 px blur) over whatever is
 * beneath, and the card at the bottom. Reached straight from the app's entry redirect it first puts Markets under
 * itself. Close, Skip, a tap on the scrim, or connecting on the last screen all end it, as on web.
 */
export default function WelcomeScreen() {
  const { name } = useTheme();
  const t = activityTokens(name);
  const { over } = useLocalSearchParams<{ over?: string }>();
  const [step, setStep] = useState(0);

  // The entry redirect lands here with nothing beneath; web shows this over /markets, so open Markets and come back on top.
  useEffect(() => {
    if (over !== "1" && !router.canGoBack()) {
      router.replace("/markets");
      setTimeout(() => router.push({ pathname: "/welcome", params: { over: "1" } }), 0);
    }
  }, [over]);

  const dismiss = useCallback(() => {
    storage.set(ONBOARDED_KEY, true);
    globalThis.localStorage?.setItem("agari.tutorialSeen", "1");
    haptic.tap();
    if (router.canGoBack()) router.back();
    else router.replace("/markets");
  }, []);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Welcome to Agari", headerShown: false }} />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close">
        <BlurView intensity={12} tint={name === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.tutScrim }]} />
      </Pressable>
      <TutorialCard
        step={step}
        onStep={(next) => {
          haptic.select();
          setStep(next);
        }}
        onDismiss={dismiss}
        onConnect={() => router.push("/connect")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
});
