import { Stack } from "expo-router";
import { useTheme } from "~/theme";
import { BrandTitle } from "./BrandTitle";
import { ThemeToggle } from "./ThemeToggle";

/** Each tab's native stack: the brand at the leading edge (as web's phone header), detail screens push inside the tab. */
export function TabStack() {
  const { color } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTitle: "",
        // iOS 26 seats bar items on a shared glass capsule; web's brand sits on the bare header.
        unstable_headerLeftItems: () => [{ type: "custom", element: <BrandTitle />, hidesSharedBackground: true }],
        unstable_headerRightItems: () => [{ type: "custom", element: <ThemeToggle /> }],
        headerShadowVisible: false,
        headerStyle: { backgroundColor: color.ground },
        headerTintColor: color.ink,
        contentStyle: { backgroundColor: color.ground },
      }}
    />
  );
}
