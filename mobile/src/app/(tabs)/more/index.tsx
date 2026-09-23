import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NavRow } from "@/components/ui/NavRow";
import { DRAWER_SECTIONS, type NavItem } from "@/nav/items";
import { RADIUS, SPACE, TYPE, useTheme } from "@/theme";

/** web's phone "More" drawer as a native grouped list: every section and item, in web's order. */
export default function MoreScreen() {
  const { color } = useTheme();
  const open = (item: NavItem) => (item.external ? WebBrowser.openBrowserAsync(item.href) : router.push(item.href as never));
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
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
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, gap: 22, paddingBottom: 120 },
  section: { gap: 8 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
});
