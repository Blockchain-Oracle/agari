import { router, usePathname, type Href } from "expo-router";
import { ChevronLeft, SlidersHorizontal } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { FONT } from "~/theme";
import { Econ } from "../frame/Chips";
import { useGamesTokens } from "../frame/tokens";
import { gameEntry, gameIdFromPath } from "./catalog";
import { useGames } from "./context";

/**
 * web's `GamesRail`, the one strip every games surface carries: the way back to Games (or "Games" on the hub),
 * the mode's name and — on a phone, on a row of its own — its economic label, how to play, the active match
 * and the settings. The swipe screens take its height: it steps aside on Practice and while a duel is picking.
 */
export function GamesRail() {
  const pathname = usePathname();
  const { t, color } = useGamesTokens();
  const { match, activeMatchId, openSettings, openHowTo, feedback } = useGames();
  const id = gameIdFromPath(pathname);
  const entry = id ? gameEntry(id) : null;
  if (match.phase === "picking" || pathname === "/games/practice") return null;

  const label = [styles.here, { color: color.inkSecondary }];
  return (
    <View style={[styles.rail, { backgroundColor: t.railBg, borderBottomColor: t.railBorder }]}>
      {entry ? (
        <Pressable
          onPress={() => {
            feedback("tap");
            router.navigate("/games" as Href);
          }}
          accessibilityRole="link"
          accessibilityLabel={GAMES.rail.back}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ChevronLeft size={14} color={color.inkSecondary} strokeWidth={2} />
          <Text style={label}>{GAMES.rail.back.toUpperCase()}</Text>
        </Pressable>
      ) : (
        <Text style={label} accessibilityRole="header">
          {GAMES.rail.back.toUpperCase()}
        </Text>
      )}

      {entry ? (
        <>
          <View style={[styles.sep, { backgroundColor: t.railSep }]} />
          <Text style={[styles.mode, { color: color.ink }]} numberOfLines={1}>
            {entry.nav.name}
          </Text>
        </>
      ) : null}

      <View style={styles.right}>
        {entry ? (
          <Pressable
            onPress={() => openHowTo(entry.id)}
            accessibilityRole="button"
            accessibilityLabel={GAMES.howToWords.open}
            hitSlop={8}
            style={({ pressed }) => [styles.howto, { borderColor: color.hairline }, pressed && styles.pressed]}
          >
            <Text style={[styles.howtoText, { color: color.inkSecondary }]}>?</Text>
          </Pressable>
        ) : null}
        {activeMatchId ? (
          <Pressable
            onPress={() => router.navigate("/games/duel" as Href)}
            accessibilityRole="link"
            accessibilityHint={GAMES.rail.resumeHint}
            style={({ pressed }) => [styles.resume, { borderColor: t.segOnBorder }, pressed && styles.pressed]}
          >
            <View style={[styles.resumeDot, { backgroundColor: color.accent }]} />
            <Text style={[styles.resumeText, { color: color.accent }]}>{GAMES.rail.resume.toUpperCase()}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={openSettings}
          accessibilityRole="button"
          accessibilityLabel={GAMES.rail.settings}
          hitSlop={6}
          style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
        >
          <SlidersHorizontal size={14} color={color.inkSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      {entry ? <Econ kind={entry.descriptor.economicKind} label={entry.descriptor.economicLabel} block style={styles.econ} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 6, paddingVertical: 6, paddingHorizontal: 18, borderBottomWidth: 1 },
  back: { flexDirection: "row", alignItems: "center", gap: 4 },
  here: { fontFamily: FONT.heading, fontSize: 12, lineHeight: 19.2, letterSpacing: 0.72 },
  sep: { width: 1, height: 14 },
  mode: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8, flexShrink: 1 },
  right: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  howto: { width: 28, height: 28, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  howtoText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  resume: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 9999, borderWidth: 1 },
  resumeDot: { width: 6, height: 6, borderRadius: 9999 },
  resumeText: { fontFamily: FONT.dataRegular, fontSize: 10, letterSpacing: 0.6 },
  settings: { minWidth: 32, height: 32, paddingHorizontal: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  econ: { flexBasis: "100%" },
  pressed: { transform: [{ scale: 0.97 }] },
});
