import { StyleSheet, View } from "react-native";
import { TabStack } from "~/components/shell/TabStack";
import { GamesProvider, GamesRail } from "~/features/games/shell";

/**
 * The Games tab inside web's games frame (`app/games/layout.tsx` → `GamesShell`): one settings store, the active
 * match, the settings and how-to plates, and the `GamesRail` every mode carries above its page.
 */
export default function GamesLayout() {
  return (
    <GamesProvider>
      <View style={styles.frame}>
        <GamesRail />
        <TabStack />
      </View>
    </GamesProvider>
  );
}

const styles = StyleSheet.create({ frame: { flex: 1 } });
