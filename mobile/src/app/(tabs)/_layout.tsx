import { NativeTabs } from "expo-router/unstable-native-tabs";
import { FONT, useTheme } from "@/theme";

/** Web's phone nav (components/shell/header/nav-items.ts MOBILE_NAV + the More drawer): Android's five-tab maximum. */
export default function TabsLayout() {
  const { color } = useTheme();
  return (
    <NativeTabs
      tintColor={color.accent}
      iconColor={{ default: color.inkMuted, selected: color.accent }}
      labelStyle={{ default: { color: color.inkMuted, fontFamily: FONT.bodyStrong }, selected: { color: color.accent, fontFamily: FONT.bodyStrong } }}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="markets">
        <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="show_chart" />
        <NativeTabs.Trigger.Label>Markets</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reels">
        <NativeTabs.Trigger.Icon sf="rectangle.stack.fill" md="view_carousel" />
        <NativeTabs.Trigger.Label>Reels</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="games">
        <NativeTabs.Trigger.Icon sf="gamecontroller.fill" md="sports_esports" />
        <NativeTabs.Trigger.Label>Games</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="portfolio">
        <NativeTabs.Trigger.Icon sf="wallet.bifold.fill" md="account_balance_wallet" />
        <NativeTabs.Trigger.Label>Portfolio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
