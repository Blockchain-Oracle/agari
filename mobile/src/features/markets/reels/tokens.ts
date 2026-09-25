import { useMemo } from "react";
import { useTheme } from "~/theme";
import { reelTokens, type ReelTokens } from "~/theme/web/reels";

/** The reel card's computed web colours for the current theme. */
export function useReelTokens(): ReelTokens {
  const { name } = useTheme();
  return useMemo(() => reelTokens(name), [name]);
}
