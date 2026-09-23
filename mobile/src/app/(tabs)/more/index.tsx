import { TabScreen } from "~/components/shell/TabScreen";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NavRow } from "~/components/ui/NavRow";
import { DRAWER_SECTIONS, type NavItem } from "~/nav/items";
import { openExternal } from "~/lib/external";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** web's phone drawer as the More tab: every section and destination, each one a native screen. */
export default function MoreScreen() {
  const { color } = useTheme();
  // Every Agari product path is a native screen; only the docs site lives outside the app.
  const open = (item: NavItem) => (item.external ? void openExternal(item.href) : router.push(item.href as never));
  return (
    <TabScreen>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
        <View style={styles.section}>
          <Text style={[TYPE.headline, { color: color.ink }]}>Explore Agari</Text>
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>Games, trading tools, records and guides.</Text>
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
