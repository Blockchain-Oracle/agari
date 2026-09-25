import { usePathname } from "expo-router";
import { NavSections } from "~/components/shell/NavDrawer";
import { CHROME } from "~/theme/chrome";

/** /more, reached by a link: the dock's More opens web's drawer; this route shows the same sections as a page. */
export default function MoreScreen() {
  const pathname = usePathname();
  return <NavSections pathname={pathname} bottomPad={CHROME.dockClearance} />;
}
