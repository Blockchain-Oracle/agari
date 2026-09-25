import { Redirect, useLocalSearchParams } from "expo-router";
import { marketsWithNote, NOTE_KIND } from "@/lib/routes";
import { DecisionScreen } from "~/features/desk/decision/DecisionScreen";

/**
 * `/desk/[id]/decision/[seq]` (web/src/app/desk/[id]/decision/[seq]/page.tsx): one decision in full, with Check it. A
 * seq that is not a record number is web's `notFound()`, which redirects to the markets with the "moved" note.
 */
export default function DecisionRoute() {
  const { id, seq } = useLocalSearchParams<{ id: string; seq: string }>();
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 1) return <Redirect href={marketsWithNote(NOTE_KIND.moved) as never} />;
  return <DecisionScreen id={id} seq={n} />;
}
