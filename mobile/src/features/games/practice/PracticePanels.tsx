import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { PRACTICE } from "@/features/games/practice/copy";
import { Plate, PlateBody, PlateMeta, PlateTitle, Press, useGamesTokens } from "~/features/games/frame";
import { useStageTokens } from "~/features/games/stage";
import { FONT } from "~/theme";

/** web's practice `Plate`: dealing, nothing dealable, or the venue unreadable — three sentences, never merged. */
export function ReadinessPlate({ readiness, closedLabel }: { readiness: "dealing" | "no-deck" | "unreadable"; closedLabel: string | null }) {
  if (readiness === "dealing") {
    return (
      <Plate>
        <PlateBody>{PRACTICE.deal.dealing}</PlateBody>
      </Plate>
    );
  }
  const copy = readiness === "no-deck" ? PRACTICE.deal.none : PRACTICE.deal.offline;
  return (
    <Plate>
      <PlateTitle>{copy.title}</PlateTitle>
      <PlateBody>{readiness === "no-deck" && closedLabel !== null ? PRACTICE.deal.none.closedBody(closedLabel) : copy.body}</PlateBody>
      <PlateMeta>{GAMES.card.waitingOn("the venue's live Window list")}</PlateMeta>
    </Plate>
  );
}

/** `.pr-link` (and `--quiet`): a mono 10 uppercase text button, vermilion or gray-500. */
export function PrLink({ label, onPress, quiet, disabled }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  const { color } = useStageTokens();
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={10}>
      <Text style={[styles.link, { color: quiet ? color.inkMuted : color.accent }]}>{label.toUpperCase()}</Text>
    </Press>
  );
}

/** web's first-run `.pr-tutorial`: inline beside the deck it explains, until the player says "Got it". */
export function TutorialPlate({ onDismiss }: { onDismiss: () => void }) {
  const { s, color } = useStageTokens();
  return (
    <View style={[styles.tutorial, { borderColor: s.tutorialBorder, backgroundColor: s.tutorialBg }]}>
      <Text style={[styles.tutorialTitle, { color: color.ink }]}>{PRACTICE.tutorial.title}</Text>
      <View style={styles.list}>
        {PRACTICE.tutorial.steps.map((step) => (
          <Text key={step} style={[styles.item, { color: color.inkSecondary }]}>
            {step}
          </Text>
        ))}
      </View>
      <View style={[styles.actions, styles.tutorialActions]}>
        <PrLink label={PRACTICE.tutorial.dismiss} onPress={onDismiss} />
      </View>
    </View>
  );
}

/** web's `.pr-note`: the sentence that keeps the mode honest, on screen at all times. */
export function ScoringNote() {
  const { t, color } = useGamesTokens();
  return (
    <View style={[styles.note, { borderColor: t.cardBorder, backgroundColor: t.cardBg }]}>
      <Text style={[styles.noteK, { color: color.inkMuted }]}>{PRACTICE.scoring.label.toUpperCase()}</Text>
      <Text style={[styles.noteBody, { color: color.inkSecondary }]}>{PRACTICE.scoring.body}</Text>
    </View>
  );
}

export const practiceStyles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  foot: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
});

const styles = StyleSheet.create({
  link: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.6 },
  tutorial: { borderRadius: 14, padding: 16, borderWidth: 1 },
  tutorialTitle: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  list: { marginTop: 10, paddingLeft: 18, gap: 8 },
  item: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  actions: practiceStyles.actions,
  tutorialActions: { marginTop: 12 },
  note: { gap: 6, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1 },
  noteK: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08 },
  noteBody: { fontFamily: FONT.body, fontSize: 12, lineHeight: 19.8 },
});
