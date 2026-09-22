import type { Metadata } from "next";
import { DESK } from "@/features/desk/copy";
import { DeskScreen } from "@/features/desk/DeskScreen";

export const metadata: Metadata = { title: DESK.title, description: DESK.visitor };

/** `/desk/[id]` (plan §5.11): a desk by id or owner address, read-only for anyone else when its owner shares it. */
export default async function SharedDeskRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeskScreen id={id} />;
}
