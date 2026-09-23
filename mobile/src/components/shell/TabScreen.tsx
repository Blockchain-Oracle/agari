import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Marquee } from "./Marquee";

/** A tab's root: web's live strip pinned under the header, then the tab's own content. */
export function TabScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <Marquee />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
