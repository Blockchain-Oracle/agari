import type { Metadata } from "next";
import { DESK } from "@/features/desk/copy";
import { DeskScreen } from "@/features/desk/DeskScreen";

export const metadata: Metadata = { title: DESK.studio.title, description: DESK.studio.body };

/** `/desk/new?basket=AILABS` (plan §5.4): the studio; `?edit=1` re-signs a desk's mandate as a new version. */
export default function DeskStudioRoute() {
  return <DeskScreen studio />;
}
