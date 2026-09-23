import type { GameId } from "@agari/core/games";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { useTheme } from "~/theme";
import { useGames } from "./context";

/**
 * web's `GamesRail` right side for a phone header: How to play (when on a mode) and Game settings. Drop it in
 * a game screen's header: `<Screen title="Duel" headerRight={() => <GameHeaderActions id="duel" />}>`.
 */
export function GameHeaderActions({ id }: { id?: GameId | null }) {
  const { color } = useTheme();
  const { openHowTo, openSettings } = useGames();
  return (
    <View style={styles.row}>
      {id ? (
        <Pressable
          onPress={() => openHowTo(id)}
          accessibilityRole="button"
          accessibilityLabel={GAMES.howToWords.open}
          hitSlop={6}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
        >
          <SymbolView name={{ ios: "questionmark.circle", android: "help" }} size={22} tintColor={color.ink} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={openSettings}
        accessibilityRole="button"
        accessibilityLabel={GAMES.rail.settings}
        hitSlop={6}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
      >
        <SymbolView name={{ ios: "slider.horizontal.3", android: "tune" }} size={22} tintColor={color.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  button: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
});
