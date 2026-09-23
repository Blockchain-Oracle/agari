import type { GameId } from "@agari/core/games";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GAMES } from "@/features/games/copy";
import { Button } from "~/components/kit";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";
import { gameEntry } from "./catalog";
import { EconLabel } from "./EconLabel";
import { SheetHeader } from "./SheetHeader";

/**
 * web's `HowToSheet` (Pips's per-game HOW TO): the mode's name, the honest line about whose money is at risk,
 * and its three sentences, as a bottom plate over a scrim. Closed by the scrim, the close button, "Got it" or
 * the system back gesture.
 */
export function HowToSheet({ id, onClose }: { id: GameId | null; onClose: () => void }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const entry = id ? gameEntry(id) : null;
  const lines = id ? (GAMES.howTo[id] ?? []) : [];
  return (
    <Modal visible={entry !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={GAMES.howToWords.close}
        />
        {entry ? (
          <View
            style={[
              styles.plate,
              { backgroundColor: color.ground, borderColor: color.hairline, paddingBottom: insets.bottom + 16 },
            ]}
            accessibilityViewIsModal
          >
            <SheetHeader
              eyebrow={GAMES.howToWords.eyebrow}
              title={entry.nav.name}
              onClose={onClose}
              closeLabel={GAMES.howToWords.close}
            />
            <View style={styles.body}>
              <EconLabel kind={entry.descriptor.economicKind} label={entry.descriptor.economicLabel} />
              {lines.map((line, index) => (
                <View key={line} style={[styles.step, { borderTopColor: color.hairline }]}>
                  <Text style={[styles.index, { color: color.accent }]}>{String(index + 1).padStart(2, "0")}</Text>
                  <Text style={[TYPE.body, styles.line, { color: color.ink }]}>{line}</Text>
                </View>
              ))}
              <Button label={GAMES.howToWords.got} onPress={onClose} />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  plate: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "85%",
  },
  body: { paddingHorizontal: SPACE.gutter, paddingTop: 8, gap: 14 },
  step: { flexDirection: "row", gap: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  index: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 23 },
  line: { flex: 1 },
});
