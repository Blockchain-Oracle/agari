import { ScrollView } from "react-native";
import { TabIntro } from "@/components/ui/TabIntro";

export default function PortfolioScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <TabIntro title="Portfolio" line="Track positions, money, and activity." />
    </ScrollView>
  );
}
