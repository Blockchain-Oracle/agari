import { Stack } from "expo-router";
import { OnboardingScreen } from "~/features/onboarding/OnboardingScreen";

/** `/onboarding` — the first run, before the app (S26, 09-25): no header, no dock, just the pages. */
export default function OnboardingRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, animation: "fade" }} />
      <OnboardingScreen />
    </>
  );
}
