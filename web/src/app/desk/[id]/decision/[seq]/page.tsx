import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RECORD } from "@/features/desk/copy-record";
import { DecisionScreen } from "@/features/desk/DecisionScreen";

export const metadata: Metadata = { title: RECORD.decision.sections.decision };

/** `/desk/[id]/decision/[seq]` (plan §5.9): one decision in full, with Check it. */
export default async function DecisionRoute({ params }: { params: Promise<{ id: string; seq: string }> }) {
  const { id, seq } = await params;
  const n = Number(seq);
  if (!Number.isInteger(n) || n < 1) notFound();
  return <DecisionScreen id={id} seq={n} />;
}
