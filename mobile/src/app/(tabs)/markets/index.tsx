import { TabScreen } from "~/components/shell/TabScreen";
import { MarketsScreen } from "~/features/markets/MarketsScreen";

/** The Markets tab: web's /markets (MarketsPage → MarketsScreen), the hero Window with the lanes that change it. */
export default function MarketsTab() {
  return (
    <TabScreen>
      <MarketsScreen />
    </TabScreen>
  );
}
