import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "~/theme";

/** web's ThemeToggle: ☀ in dark flips to the cream light theme, ☾ in light flips back; the choice persists. */
export function ThemeToggle() {
  const { name, color, setTheme } = useTheme();
  const dark = name === "dark";
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        setTheme(dark ? "light" : "dark");
      }}
      accessibilityRole="button"
      accessibilityLabel={dark ? "Switch to light mode" : "Switch to dark mode"}
      hitSlop={8}
      style={styles.button}
    >
      <SymbolView name={dark ? { ios: "sun.max", android: "light_mode" } : { ios: "moon", android: "dark_mode" }} size={18} tintColor={color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ button: { width: 36, height: 36, alignItems: "center", justifyContent: "center" } });
