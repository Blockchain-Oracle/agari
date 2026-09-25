import type { Hash32 } from "@agari/core/types";
import { useLocalSearchParams } from "expo-router";
import { DUEL } from "@/features/games/duel/copy";
import { GamesPage } from "~/features/games/frame";
import { DuelScreen } from "~/features/games/duel/DuelScreen";
import { Refusal } from "~/features/games/duel/parts";

/**
 * web's `/games/duel/[matchId]`: a seat resumes the match here, anyone else reads its result. The id is the arena's
 * bytes32; anything else is not a match — web answers notFound(), the app says so on the games page.
 */
export default function DuelMatchRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  if (!matchId || !/^0x[0-9a-fA-F]{64}$/.test(matchId)) {
    return (
      <GamesPage>
        <Refusal>{DUEL.public.unknown}</Refusal>
      </GamesPage>
    );
  }
  return <DuelScreen resumeMatchId={matchId.toLowerCase() as Hash32} />;
}
