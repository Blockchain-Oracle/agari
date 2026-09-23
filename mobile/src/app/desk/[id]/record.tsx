import { useLocalSearchParams } from "expo-router";
import { RecordScreen } from "~/features/desk/record/RecordScreen";

/** `/desk/[id]/record` (web/src/app/desk/[id]/record/page.tsx): every decision, quiet runs folded. */
export default function RecordRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecordScreen id={id} />;
}
