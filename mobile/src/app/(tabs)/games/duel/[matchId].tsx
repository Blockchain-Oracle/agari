import type { Hash32 } from "@agari/core/types";
import { useLocalSearchParams } from "expo-router";
import { DUEL } from "@/features/games/duel/copy";
import { EmptyState, Screen } from "~/components/kit";
import { DuelScreen } from "~/features/games/duel/DuelScreen";

/**
 * web's `/games/duel/[matchId]`: a seat resumes the match here, anyone else reads its result. The id is the arena's
 * bytes32; anything else is not a match (web answers notFound()).
 */
export default function DuelMatchRoute() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  if (!matchId || !/^0x[0-9a-fA-F]{64}$/.test(matchId)) {
    return (
      <Screen title={DUEL.title}>
        <EmptyState why={DUEL.public.unknown} />
      </Screen>
    );
  }
  return <DuelScreen resumeMatchId={matchId.toLowerCase() as Hash32} />;
}
