import type { ReactNode } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, SignReview, type QuoteLine, type SignPhase } from "~/components/kit";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

export interface SignOutcome {
  tone: "ok" | "warn";
  text: string;
}

interface SignSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  lines: readonly QuoteLine[];
  maxLoss: string | null;
  confirmLabel: string;
  onConfirm: () => void;
  phase: SignPhase;
  blocker?: string | null;
  tone?: "profit" | "loss" | "accent";
  /** What the write came back with, in a sentence: the landed amount, or the refusal. */
  outcome?: SignOutcome | null;
  /** Anything the review needs above the quote (a live progress list, a claim receipt). */
  children?: ReactNode;
}

/**
 * Every Portfolio write goes through this native page sheet: the exact quote and the maximum loss (kit `SignReview`),
 * a deliberate slide, then the wallet's own approval. The sheet stays until the outcome is read, and cannot be
 * dismissed while a signature is in flight.
 */
export function SignSheet(props: SignSheetProps) {
  const { visible, onClose, title, lines, maxLoss, confirmLabel, onConfirm, phase, blocker, tone, outcome, children } = props;
  const { color } = useTheme();
  const busy = phase === "signing" || phase === "sending";
  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Review and sign</Text>
          <Button label={phase === "done" ? "Done" : "Close"} variant="ghost" size="sm" block={false} disabled={busy} onPress={close} />
        </View>
        {children}
        <SignReview
          title={title}
          lines={lines}
          maxLoss={maxLoss}
          confirmLabel={confirmLabel}
          onConfirm={onConfirm}
          phase={phase}
          blocker={blocker}
          tone={tone}
        />
        {outcome ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.outcome, { backgroundColor: outcome.tone === "ok" ? color.surface1 : color.lossWash, borderColor: color.hairline }]}
          >
            <Text style={[TYPE.bodyStrong, { color: outcome.tone === "ok" ? color.ink : color.loss }]}>{outcome.text}</Text>
          </View>
        ) : null}
        {phase === "done" ? <Button label="Done" onPress={close} /> : null}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingBottom: 48, gap: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  outcome: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
});
