import { StyleSheet, Text, View } from "react-native";
import { GAMES } from "@/features/games/copy";
import { PRACTICE } from "@/features/games/practice/copy";
import { Button } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

/** web's practice `Plate`: dealing, nothing dealable, or the venue unreadable — three sentences, never merged. */
export function ReadinessPlate({ readiness, closedLabel }: { readiness: "dealing" | "no-deck" | "unreadable"; closedLabel: string | null }) {
  const { color } = useTheme();
  const plate = [styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }];
  if (readiness === "dealing") {
    return (
      <View style={plate} accessibilityLiveRegion="polite">
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{PRACTICE.deal.dealing}</Text>
      </View>
    );
  }
  const copy = readiness === "no-deck" ? PRACTICE.deal.none : PRACTICE.deal.offline;
  const body = readiness === "no-deck" && closedLabel !== null ? PRACTICE.deal.none.closedBody(closedLabel) : copy.body;
  return (
    <View style={plate}>
      <Text style={[TYPE.title, { color: color.ink }]}>{copy.title}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{body}</Text>
      <Text style={[styles.meta, { color: color.inkMuted }]}>{GAMES.card.waitingOn("the venue's live Window list")}</Text>
    </View>
  );
}

/** web's first-run tutorial panel (`pr-tutorial`), shown until the player dismisses it; "How this works" brings it back. */
export function TutorialPlate({ onDismiss }: { onDismiss: () => void }) {
  const { color } = useTheme();
  return (
    <View style={[styles.plate, { backgroundColor: color.cream, borderColor: color.creamHairline }]}>
      <Text style={[TYPE.title, { color: color.creamInk }]}>{PRACTICE.tutorial.title}</Text>
      {PRACTICE.tutorial.steps.map((step, index) => (
        <View key={step} style={[styles.step, { borderTopColor: color.creamHairline }]}>
          <Text style={[styles.index, { color: color.accent }]}>{String(index + 1).padStart(2, "0")}</Text>
          <Text style={[TYPE.body, styles.stepText, { color: color.creamInk }]}>{step}</Text>
        </View>
      ))}
      <Button label={PRACTICE.tutorial.dismiss} onPress={onDismiss} />
    </View>
  );
}

/** web's `pr-note`: the sentence that keeps the mode honest, on screen at all times. */
export function ScoringNote() {
  const { color } = useTheme();
  return (
    <View style={[styles.note, { borderLeftColor: color.accent }]}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{PRACTICE.scoring.label}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{PRACTICE.scoring.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 16, gap: 10 },
  meta: { fontFamily: FONT.data, fontSize: 11 },
  step: { flexDirection: "row", gap: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  index: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 23 },
  stepText: { flex: 1 },
  note: { borderLeftWidth: 2, paddingLeft: 12, gap: 4 },
});
