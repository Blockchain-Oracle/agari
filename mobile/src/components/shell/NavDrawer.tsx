import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "~/components/logos/Logo";
import { openExternal } from "~/lib/external";
import { DRAWER_SECTIONS, type NavItem } from "~/nav/items";
import { FONT, useTheme } from "~/theme";
import { chromeTokens } from "~/theme/chrome";

/**
 * web's More drawer (MobileBottomNav's SheetContent side="right", navigation.css .mobile-nav-*): full width on a
 * phone, slides in from the right over a 72 % scrim; "Navigate" kicker, "Everything in Agari", the line under it,
 * then every section with its mono title and each destination as an icon tile, name and one line.
 */
export function NavDrawer({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { name, color } = useTheme();
  const t = chromeTokens(name);
  const [mounted, setMounted] = useState(open);
  const x = useSharedValue(width);

  useEffect(() => {
    if (open) {
      setMounted(true);
      x.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      x.value = withTiming(width, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => done && runOnJS(setMounted)(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: 1 - x.value / width }));


  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.navOverlay }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close navigation" />
      </Animated.View>
      <Animated.View style={[styles.panel, { backgroundColor: color.ground }, panel]} accessibilityViewIsModal>
        <View style={[styles.header, { paddingTop: Math.max(20, insets.top), borderBottomColor: t.navDivider }]}>
          <Text style={[styles.kicker, { color: color.accent }]}>NAVIGATE</Text>
          <Text style={[styles.title, { color: color.ink }]}>Everything in Agari</Text>
          <Text style={[styles.desc, { color: color.inkMuted }]}>Build, trade, verify, or learn—every destination has one home.</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={[styles.close, { top: Math.max(20, insets.top) }]}>
            <X size={16} color={color.inkSecondary} strokeWidth={2} />
          </Pressable>
        </View>
        <NavSections pathname={pathname} onGo={onClose} bottomPad={24 + insets.bottom} />
      </Animated.View>
    </Modal>
  );
}

/** The drawer's sections — also the More screen's body. */
export function NavSections({ pathname, onGo, bottomPad }: { pathname: string; onGo?: () => void; bottomPad: number }) {
  const { name, color } = useTheme();
  const t = chromeTokens(name);
  const go = (item: NavItem) => {
    Haptics.selectionAsync();
    onGo?.();
    if (item.external) void openExternal(item.href);
    else router.push(item.href as never);
  };
  return (
    <ScrollView contentContainerStyle={[styles.groups, { paddingBottom: bottomPad }]}>
      {DRAWER_SECTIONS.map((section, i) => (
        <View key={section.id} style={[styles.group, i > 0 && { borderTopWidth: 1, borderTopColor: t.navSectionDivider }]}>
          <View style={styles.groupTitle}>
            <Text style={[styles.groupName, { color: color.ink }]}>{section.name.toUpperCase()}</Text>
            <Text style={[styles.groupDesc, { color: color.inkMuted }]}>{section.description}</Text>
          </View>
          <View style={styles.links}>
            {section.items.map((item) => {
              const active = !item.external && (pathname === item.href || pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.href}
                  onPress={() => go(item)}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.link, (active || pressed) && { borderColor: t.navItemBorder, backgroundColor: t.navItemFill }]}
                >
                  <View style={[styles.icon, { borderColor: active ? t.navActiveBorder : t.navIconBorder }]}>
                    {item.logo ? <Logo brand={item.logo} size={15} /> : <Icon size={17} color={active ? color.accent : color.inkMuted} strokeWidth={1.8} />}
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.name, { color: t.navLinkInk }]}>
                      {item.name}
                      {item.beta ? <Text style={[styles.beta, { color: color.accent }]}>{"  BETA"}</Text> : null}
                    </Text>
                    <Text style={[styles.small, { color: color.inkMuted }]}>{item.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  kicker: { fontFamily: FONT.dataStrong, fontSize: 9.6, letterSpacing: 1.73 },
  title: { marginTop: 5.6, fontFamily: FONT.headingHeavy, fontSize: 20, letterSpacing: -0.4 },
  desc: { marginTop: 4.8, maxWidth: 280, fontFamily: FONT.body, fontSize: 12, lineHeight: 17.4 },
  close: { position: "absolute", right: 16, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  groups: { paddingTop: 5.6, paddingHorizontal: 16 },
  group: { paddingVertical: 16 },
  groupTitle: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingHorizontal: 4, paddingBottom: 8.8 },
  groupName: { fontFamily: FONT.dataStrong, fontSize: 10.4, letterSpacing: 1.56 },
  groupDesc: { fontFamily: FONT.dataRegular, fontSize: 9.3 },
  links: { gap: 4 },
  link: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, padding: 8.8, borderWidth: 1, borderColor: "transparent", borderRadius: 9.6 },
  icon: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bodyStrong, fontSize: 12.5, lineHeight: 15 },
  beta: { fontFamily: FONT.data, fontSize: 8 },
  small: { marginTop: 4, fontFamily: FONT.body, fontSize: 10.9, lineHeight: 14.7 },
});
