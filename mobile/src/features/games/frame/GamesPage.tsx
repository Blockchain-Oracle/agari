import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { CHROME } from "~/theme/chrome";
import { Checker } from "./Checker";
import { useGamesTokens } from "./tokens";

interface Props {
  children: ReactNode;
  /** false for a stage that fills the screen and scrolls nothing (the arcade canvas). */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * One games page under the rail: web's `.container.gm-page` (28 px top, 18 px sides, 64 px bottom) over the
 * drifting checker, plus main's 112 px of clearance for the floating dock.
 */
export function GamesPage({ children, scroll = true, refreshing = false, onRefresh, contentStyle }: Props) {
  const { color } = useGamesTokens();
  if (!scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: color.ground }]}>
        <Checker />
        <View style={[styles.page, styles.fill, contentStyle]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: color.ground }]}
      contentContainerStyle={[styles.page, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.inkMuted} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      <Checker />
      {children}
    </ScrollView>
  );
}

/** The page's own padding, for a screen that lays out its own scroller (a FlatList). */
export const PAGE_PADDING = { paddingTop: 28, paddingHorizontal: 18, paddingBottom: 64 + CHROME.dockClearance } as const;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: PAGE_PADDING,
});
