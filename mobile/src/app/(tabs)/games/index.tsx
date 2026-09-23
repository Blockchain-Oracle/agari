import { TabScreen } from "~/components/shell/TabScreen";
import { ScrollView } from "react-native";
import { TabIntro } from "~/components/ui/TabIntro";

export default function GamesScreen() {
  return (
    <TabScreen>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <TabIntro title="Games" line="Play every market-powered game." />
      </ScrollView>
    </TabScreen>
  );
}
