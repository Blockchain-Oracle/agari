import { TabScreen } from "~/components/shell/TabScreen";
import { ScrollView } from "react-native";
import { TabIntro } from "~/components/ui/TabIntro";

export default function PortfolioScreen() {
  return (
    <TabScreen>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <TabIntro title="Portfolio" line="Track positions, money, and activity." />
      </ScrollView>
    </TabScreen>
  );
}
