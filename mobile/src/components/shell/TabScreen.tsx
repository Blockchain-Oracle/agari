import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

/** A tab's root. The strip, marquee and header now sit in the app chrome above every screen, as on web. */
export function TabScreen({ children }: { children: ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({ root: { flex: 1 } });
