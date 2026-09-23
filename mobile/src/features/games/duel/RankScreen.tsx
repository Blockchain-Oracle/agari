import { GAMES } from "@/features/games/copy";
import { Screen } from "~/components/kit";
import { GameHeaderActions } from "../shell";
import { DuelRank, useLadder } from "./DuelRank";

/** `/games/rank`: the ladder, pull to refresh re-reads it. */
export function RankScreen() {
  const { feed, reload } = useLadder();
  return (
    <Screen title={GAMES.rankPage.title} onRefresh={reload} headerRight={() => <GameHeaderActions />}>
      <DuelRank feed={feed} />
    </Screen>
  );
}
