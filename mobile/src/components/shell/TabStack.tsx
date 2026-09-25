import { Stack } from "expo-router";
import { useTheme } from "~/theme";

/** Each tab's stack: web's header is the app chrome above it, so screens push with no native bar (edge swipe goes back). */
export function TabStack() {
  const { color } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground } }} />;
}
