import type { Metadata } from "next";
import { RECORD } from "@/features/desk/copy-record";
import { RecordScreen } from "@/features/desk/RecordList";

export const metadata: Metadata = { title: RECORD.list.title, description: RECORD.list.intro };

/** `/desk/[id]/record` (plan §5.7 item 7): every decision, quiet runs folded, the owner's first visit noted. */
export default async function RecordRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordScreen id={id} />;
}
