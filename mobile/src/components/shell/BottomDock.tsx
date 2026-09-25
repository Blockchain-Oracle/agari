import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { ChartLine, GalleryVerticalEnd, Gamepad2, MoreHorizontal, WalletCards, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DRAWER_SECTIONS } from "~/nav/items";
import { FONT, useTheme } from "~/theme";
import { chromeTokens } from "~/theme/chrome";
import { NavDrawer } from "./NavDrawer";

interface DockItem { name: string; href: string; icon: LucideIcon; match: (path: string) => boolean }

/** web's MOBILE_NAV and isActiveNavItem: Markets, Reels, Games (with its sub-routes), Portfolio (exact). */
const DOCK: readonly DockItem[] = [
  { name: "Markets", href: "/markets", icon: ChartLine, match: (p) => p === "/markets" || p.startsWith("/markets/") || p.startsWith("/tickers/") },
  { name: "Reels", href: "/reels", icon: GalleryVerticalEnd, match: (p) => p.startsWith("/reels") },
  { name: "Games", href: "/games", icon: Gamepad2, match: (p) => p === "/games" || p.startsWith("/games/") },
  { name: "Portfolio", href: "/portfolio", icon: WalletCards, match: (p) => p === "/portfolio" },
];

const DRAWER_PATHS = DRAWER_SECTIONS.flatMap((s) => s.items.filter((i) => !i.external).map((i) => i.href));

/**
 * web's floating pill (navigation.css .mobile-bottom-nav at phone width): 0.8rem off the bottom, lifted just clear of the home indicator,
 * min(26rem, 100vw − 20px) wide, blur 24 over a 72 % ink ground, five equal cells of an 18 px lucide icon over a
 * 9 px label; the active cell fills and its icon turns vermilion. More opens web's right-hand drawer.
 */
export function BottomDock() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { name, color } = useTheme();
  const t = chromeTokens(name);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);

  const fast = DOCK.some((d) => d.match(pathname));
  const moreActive = drawer || (!fast && DRAWER_PATHS.some((h) => pathname === h || pathname.startsWith(`${h}/`)));
  const go = (href: string) => {
    Haptics.selectionAsync();
    router.navigate(href as never);
  };

  const cell = (key: string, label: string, Icon: LucideIcon, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      style={[styles.cell, active && { backgroundColor: t.dockActiveFill }]}
    >
      <Icon size={18} color={active ? color.accent : t.dockInk} strokeWidth={1.8} />
      <Text style={[styles.label, { color: active ? t.dockActiveInk : t.dockInk }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(12.8, insets.bottom - 8) }]}>
        <View style={[styles.dock, { width: Math.min(416, width - 20), borderColor: t.dockBorder }]} accessibilityRole="tablist">
          <BlurView intensity={40} tint={name === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.dockBg }]} />
          {DOCK.map((d) => cell(d.href, d.name, d.icon, d.match(pathname), () => go(d.href)))}
          {cell("more", "More", MoreHorizontal, moreActive, () => { Haptics.selectionAsync(); setDrawer(true); })}
        </View>
      </View>
      <NavDrawer open={drawer} onClose={() => setDrawer(false)} pathname={pathname} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  dock: { flexDirection: "row", gap: 2, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 999, borderWidth: 1, overflow: "hidden" },
  cell: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 6.75, paddingHorizontal: 5.25, borderRadius: 999 },
  label: { fontFamily: FONT.bodyMedium, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.18 },
});
