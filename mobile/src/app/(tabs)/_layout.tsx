import { Tabs } from "expo-router";
import { useTheme } from "~/theme";

/**
 * The four tab stacks behind web's phone dock (its fifth cell, More, opens the drawer — web has no /more page). The dock itself (components/shell/BottomDock) is web's floating pill,
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
    </Tabs>
  );
}
