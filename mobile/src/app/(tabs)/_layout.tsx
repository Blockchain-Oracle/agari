import { Tabs } from "expo-router";
import { useTheme } from "~/theme";

/**
 * The five tab stacks behind web's phone dock. The dock itself (components/shell/BottomDock) is web's floating pill,
 * drawn at the root over every screen, so the system tab bar is not shown.
 */
export default function TabsLayout() {
  const { color } = useTheme();
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.ground }, animation: "none" }}
    >
      <Tabs.Screen name="markets" />
      <Tabs.Screen name="reels" />
      <Tabs.Screen name="games" />
      <Tabs.Screen name="portfolio" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
