import { router, type Href } from "expo-router";
import { Pressable, Text, type StyleProp, type TextStyle } from "react-native";
import { DT, useDeskTheme } from "./theme";

/** web's `.dk-link.type-caption`: accent text that opens an in-app route (its underline is transparent on web). */
export function DkLink({ label, href, style }: { label: string; href: string; style?: StyleProp<TextStyle> }) {
  const { color } = useDeskTheme();
  return (
    <Pressable onPress={() => router.push(href as Href)} accessibilityRole="link" hitSlop={8}>
      <Text style={[DT.caption, { color: color.accent }, style]}>{label}</Text>
    </Pressable>
  );
}
