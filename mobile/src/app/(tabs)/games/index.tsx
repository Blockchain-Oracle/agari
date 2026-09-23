import { ScrollView } from "react-native";
import { TabIntro } from "@/components/ui/TabIntro";

export default function GamesScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <TabIntro title="Games" line="Play every market-powered game." />
    </ScrollView>
  );
}
