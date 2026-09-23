import { useLocalSearchParams } from "expo-router";
import { EmptyState, Screen } from "~/components/kit";
import { DecisionScreen } from "~/features/desk/decision/DecisionScreen";

/** `/desk/[id]/decision/[seq]` (web/src/app/desk/[id]/decision/[seq]/page.tsx): one decision in full, with Check it. */
export default function DecisionRoute() {
  const { id, seq } = useLocalSearchParams<{ id: string; seq: string }>();
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 1) {
    return (
      <Screen title="Decision">
        <EmptyState why="There is no decision with that number." />
      </Screen>
    );
  }
  return <DecisionScreen id={id} seq={n} />;
}
