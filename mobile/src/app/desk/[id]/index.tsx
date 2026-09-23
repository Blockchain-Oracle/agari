import { useLocalSearchParams } from "expo-router";
import { DeskRoot } from "~/features/desk/DeskRoot";

/** `/desk/[id]` (web/src/app/desk/[id]/page.tsx): a desk by id or owner address, read-only for anyone but its owner. */
export default function SharedDeskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DeskRoot id={id} />;
}
