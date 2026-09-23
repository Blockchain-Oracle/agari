import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { storage } from "~/lib/storage";
import { DARK, LIGHT, type Palette } from "./palette";

export { FONT, RADIUS, SPACE, TYPE } from "./type";
export type { Palette } from "./palette";
export { AVATAR_COLORS } from "./palette";

export type ThemeName = "dark" | "light";
/** Web's key (lib/theme.ts): a stored choice wins over the system setting. */
const THEME_KEY = "agari_theme";

interface ThemeValue {
  name: ThemeName;
  color: Palette;
  setTheme: (name: ThemeName | null) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [stored, setStored] = useMMKVString(THEME_KEY, storage);
  const name: ThemeName = stored === "light" || stored === "dark" ? stored : system === "light" ? "light" : "dark";
  const value = useMemo<ThemeValue>(
    () => ({ name, color: name === "dark" ? DARK : LIGHT, setTheme: (next) => setStored(next ?? undefined) }),
    [name, setStored],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme outside ThemeProvider");
  return value;
}
