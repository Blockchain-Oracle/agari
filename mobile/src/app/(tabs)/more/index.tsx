import { TabScreen } from "~/components/shell/TabScreen";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NavRow } from "~/components/ui/NavRow";
import { DRAWER_SECTIONS, type NavItem } from "~/nav/items";
import { SITE_URL } from "~/lib/env";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** The smaller native app opens web-only product paths in an in-app browser. */
export default function MoreScreen() {
  const { color } = useTheme();
  const open = (item: NavItem) => {
    if (item.href === "/games" || item.href === "/games/practice" || item.href === "/markets" || item.href === "/reels" || item.href === "/portfolio" || item.href === "/proof") return router.navigate(item.href);
    return WebBrowser.openBrowserAsync(item.external ? item.href : new URL(item.href, SITE_URL).toString());
  };
  return (
    <TabScreen>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
        <View style={styles.section}>
          <Text style={[TYPE.headline, { color: color.ink }]}>Explore Agari</Text>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>More tools, records and guides. Web-only paths open here without leaving the app.</Text>
        </View>
        {DRAWER_SECTIONS.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{section.name}</Text>
            <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
              {section.items.map((item, index) => (
                <NavRow key={item.href} item={item} last={index === section.items.length - 1} onPress={() => open(item)} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, gap: 22, paddingBottom: 120 },
  section: { gap: 8 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
});
