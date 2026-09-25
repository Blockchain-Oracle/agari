import { GamesPage } from "~/features/games/frame";
import { DuelRank, useLadder } from "./DuelRank";

/** `/games/rank`: web's ladder page under the games rail; pull to refresh re-reads it. */
export function RankScreen() {
  const { feed, reload } = useLadder();
  return (
    <GamesPage onRefresh={() => void reload()}>
      <DuelRank feed={feed} />
    </GamesPage>
  );
}
