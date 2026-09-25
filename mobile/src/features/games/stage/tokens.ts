import { useMemo } from "react";
import { useTheme } from "~/theme";
import { stageTokens, type StageTokens } from "~/theme/web/games-stage";

/** stage.css / practice.css as computed on web, for the current theme, beside the app's own roles. */
export function useStageTokens(): { s: StageTokens; color: ReturnType<typeof useTheme>["color"] } {
  const { name, color } = useTheme();
  return useMemo(() => ({ s: stageTokens(name), color }), [name, color]);
}
