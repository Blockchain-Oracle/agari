import { TabScreen } from "~/components/shell/TabScreen";
import { ScrollView } from "react-native";
import { TabIntro } from "~/components/ui/TabIntro";

export default function ReelsScreen() {
  return (
    <TabScreen>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <TabIntro title="Reels" line="Scan market stories quickly." />
      </ScrollView>
    </TabScreen>
  );
}
