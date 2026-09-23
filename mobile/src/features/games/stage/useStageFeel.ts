import type { FeedbackCue } from "@/features/games/feedback";
import { useGames } from "../shell/context";

/**
 * The two things web's stages take from `useGames()`: the resolved motion answer and the feedback cue. They come
 * from the Games tab's shell (`../shell/GamesProvider`), so a change in the settings sheet reaches the deck at once.
 */
export function useStageFeel(): { reducedMotion: boolean; feedback: (cue: FeedbackCue) => void } {
  const { reducedMotion, feedback } = useGames();
  return { reducedMotion, feedback };
}
