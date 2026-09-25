import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Screen } from "~/components/kit";
import { CHROME } from "~/theme/chrome";

interface Props {
  /** What VoiceOver reads on arrival. */
  title: string;
  children: ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  /** false for a page that owns its scrolling (the pitch pager, the Sensei thread). */
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * web's `main.page-shell` on a phone under the chrome: the `.container` gutter (0 18 px) and the 112 px floor the
 * floating dock needs. Sections carry their own vertical rhythm, as web's do.
 */
export function ExplorePage({ title, children, onRefresh, scroll, style }: Props) {
  return (
    <Screen title={title} onRefresh={onRefresh} scroll={scroll} contentStyle={[styles.container, style]}>
      {children}
    </Screen>
  );
}

export const CONTAINER_GUTTER = 18;

const styles = StyleSheet.create({
  container: { paddingHorizontal: CONTAINER_GUTTER, paddingTop: 0, paddingBottom: CHROME.dockClearance, gap: 0 },
});
