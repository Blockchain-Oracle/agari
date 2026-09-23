import type { Hash32 } from "@agari/core/types";
import { DUEL } from "@/features/games/duel/copy";
import { Screen } from "~/components/kit";
import { GameHeaderActions, useGameScreen } from "../shell";
import { DuelStage } from "./DuelStage";

/** The duel's route scaffold: the native header with web's rail actions, and the stage laying itself out. */
export function DuelScreen({ resumeMatchId = null }: { resumeMatchId?: Hash32 | null }) {
  useGameScreen("duel");
  return (
    <Screen title={DUEL.title} scroll={false} headerRight={() => <GameHeaderActions id="duel" />}>
      <DuelStage resumeMatchId={resumeMatchId} />
    </Screen>
  );
}
