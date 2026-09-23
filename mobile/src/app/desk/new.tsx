import { DeskRoot } from "~/features/desk/DeskRoot";

/** `/desk/new?basket=AILABS` (web/src/app/desk/new/page.tsx): the studio; `?edit=1` re-signs the mandate as a new version. */
export default function DeskStudioRoute() {
  return <DeskRoot studio />;
}
