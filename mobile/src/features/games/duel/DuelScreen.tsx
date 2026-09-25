import type { Hash32 } from "@agari/core/types";
import { useGameScreen } from "../shell";
import { DuelStage } from "./DuelStage";

/** The duel's route: web's `/games/duel` page under the games rail (the layout draws the rail, and its how-to and settings). */
export function DuelScreen({ resumeMatchId = null }: { resumeMatchId?: Hash32 | null }) {
  useGameScreen("duel");
  return <DuelStage resumeMatchId={resumeMatchId} />;
}
