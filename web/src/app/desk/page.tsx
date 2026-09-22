import type { Metadata } from "next";
import { DESK } from "@/features/desk/copy";
import { DeskScreen } from "@/features/desk/DeskScreen";

export const metadata: Metadata = { title: DESK.title, description: DESK.studio.body };

/** `/desk` (S21, D-126): your desk, or the studio if you have none. */
export default function DeskRoute() {
  return <DeskScreen />;
}
