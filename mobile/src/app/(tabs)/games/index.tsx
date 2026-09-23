import { TabScreen } from "~/components/shell/TabScreen";
import { GamesHub } from "~/features/games/hub/GamesHub";

/** The Games tab's root: web's `/games` hub under the live strip. */
export default function GamesScreen() {
  return (
    <TabScreen>
      <GamesHub />
    </TabScreen>
  );
}
