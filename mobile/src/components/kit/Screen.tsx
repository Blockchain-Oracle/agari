import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SPACE, useTheme } from "~/theme";
import { usePullRefresh } from "./PullRefresh";

interface Props {
  /** What VoiceOver reads on arrival. */
  title: string;
  children: ReactNode;
  /** Pull to refresh: the screen's own refetch; without one, every query on screen refetches. */
  onRefresh?: () => Promise<unknown> | void;
  /** Header trailing control (a filter, a help button). */
  headerRight?: () => ReactNode;
  /** false for screens that manage their own scrolling (a game stage, a list). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * A pushed screen under web's chrome: the page ground, the 16-pt gutter and room below the floating dock; the edge
 * swipe (iOS) or the system back (Android) goes back, as the browser's back does on web.
 */
export function Screen({ title, children, onRefresh, headerRight, scroll = true, contentStyle }: Props) {
  const { color } = useTheme();
  const refreshControl = usePullRefresh(onRefresh);

  // web's pages carry no bar of their own under the site header: the title only names the screen for VoiceOver, and a
  // trailing control (a game's settings) sits at the top right of the content.
  const header = (
    <>
      <Stack.Screen options={{ title, headerShown: false }} />
      {headerRight ? <View style={styles.trailing}>{headerRight()}</View> : null}
    </>
  );

  if (!scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: color.ground }]}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <>
      {header}
      <ScrollView
        style={[styles.fill, { backgroundColor: color.ground }]}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.body, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SPACE.gutter, paddingTop: 12, paddingBottom: 120, gap: 16 },
  trailing: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 8 },
});
