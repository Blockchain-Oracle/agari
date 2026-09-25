import { useMemo } from "react";
import { useTheme } from "~/theme";
import { gamesTokens, type GamesTokens } from "~/theme/web/games";

/** The games frame's computed web colours for the current theme, beside the app's own roles. */
export function useGamesTokens(): { t: GamesTokens; color: ReturnType<typeof useTheme>["color"]; dark: boolean } {
  const { name, color } = useTheme();
  return useMemo(() => ({ t: gamesTokens(name), color, dark: name === "dark" }), [name, color]);
}
