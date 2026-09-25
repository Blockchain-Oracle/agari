import type { GameId } from "@agari/core/games";
import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { FONT } from "~/theme";
import { Econ } from "../frame/Chips";
import { Cta } from "../frame/Cta";
import { GameModal } from "../frame/GameModal";
import { Eyebrow } from "../frame/PageHero";
import { useGamesTokens } from "../frame/tokens";
import { gameEntry } from "./catalog";

/**
 * web's `HowToSheet` (Pips's per-game HOW TO): the mode's name, the honest line about whose money is at risk and
 * its three sentences, in the shell's overlay grammar (a centred plate over a scrim); closed by the scrim, the ✕,
 * "Got it" or the system back.
 */
export function HowToSheet({ id, onClose }: { id: GameId | null; onClose: () => void }) {
  const { color } = useGamesTokens();
  const entry = id ? gameEntry(id) : null;
  const lines = id ? (GAMES.howTo[id] ?? []) : [];
  return (
    <GameModal open={entry !== null} onClose={onClose} closeLabel={GAMES.howToWords.close}>
      {entry ? (
        <>
          <Eyebrow style={styles.eyebrow}>{GAMES.howToWords.eyebrow}</Eyebrow>
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {entry.nav.name}
          </Text>
          <Econ kind={entry.descriptor.economicKind} label={entry.descriptor.economicLabel} block />
          <View style={styles.steps}>
            {lines.map((line) => (
              <Text key={line} style={[styles.step, { color: color.inkSecondary }]}>
                {line}
              </Text>
            ))}
          </View>
          <Cta label={GAMES.howToWords.got} onPress={onClose} />
        </>
      ) : null}
    </GameModal>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginBottom: 12 },
  title: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 35.2 },
  steps: { gap: 8, paddingLeft: 20 },
  step: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
});
