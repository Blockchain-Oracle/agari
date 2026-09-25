import * as Haptics from "expo-haptics";
import { Moon, Sun } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "~/theme";
import { chromeTokens } from "~/theme/chrome";

/** web's ThemeToggle: a 28 px ring, lucide ☀ in dark (to the cream light theme), ☾ in light; the choice persists. */
export function ThemeToggle() {
  const { name, setTheme } = useTheme();
  const t = chromeTokens(name);
  const dark = name === "dark";
  const Icon = dark ? Sun : Moon;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        setTheme(dark ? "light" : "dark");
      }}
      accessibilityRole="button"
      accessibilityLabel={dark ? "Switch to light mode" : "Switch to dark mode"}
      hitSlop={8}
      style={[styles.ring, { borderColor: t.toggleBorder }]}
    >
      <Icon size={14} color={t.toggleInk} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ ring: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" } });
