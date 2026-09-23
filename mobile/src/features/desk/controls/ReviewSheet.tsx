import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { useEffect, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { CONTROLS } from "@/features/desk/copy-controls";
import type { DeskPhase } from "@/features/desk/useDeskWrites";
import { Button, haptic, SignReview, type QuoteLine, type SignPhase } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { SPACE, TYPE, useTheme } from "~/theme";
import { Eyebrow } from "../kit";

export interface Review {
  title: string;
  lines: readonly QuoteLine[];
  /** The most this can cost, in words the reader can check ("$0.00 · practice, no money moves"). */
  maxLoss: string;
  confirmLabel: string;
  blocker?: string | null;
  tone?: "profit" | "loss" | "accent";
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  /** web's money eyebrow ("SOLANA MAINNET · REAL MONEY") on a card that can move money. */
  eyebrow?: string;
  /** The card's own controls (a mode picker, an amount), above the review. */
  children?: ReactNode;
  review: Review;
  onConfirm: () => void;
  phase: DeskPhase;
  problem: string | null;
  signature?: Signature | null;
  /** What to say once it landed; web's "Done." otherwise. */
  done?: string | null;
}

const PHASE: Record<DeskPhase, SignPhase> = { idle: "review", signing: "signing", sending: "sending", confirming: "sending", done: "done", failed: "review" };

/**
 * A control's card as a native sheet (web's ControlCard.tsx inside its bottom Sheet): what changes, then kit
 * SignReview with the exact lines and the maximum loss, a slide, and the outcome written on the same sheet.
 */
export function ReviewSheet({ visible, onClose, title, body, eyebrow, children, review, onConfirm, phase, problem, signature, done }: Props) {
  const { color } = useTheme();
  const C = CONTROLS.card;
  const busy = phase === "signing" || phase === "sending" || phase === "confirming";
  useEffect(() => {
    if (phase === "done") haptic.success();
    if (phase === "failed") haptic.error();
  }, [phase]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={busy ? undefined : onClose}>
      <View style={[styles.sheet, { backgroundColor: color.ground }]}>
        <View style={[styles.grabber, { backgroundColor: color.borderStrong }]} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {eyebrow ? <Eyebrow text={eyebrow} live /> : null}
          <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
            {title}
          </Text>
          {body ? <Text style={[TYPE.body, { color: color.inkSecondary }]}>{body}</Text> : null}
          {children}
          {phase === "done" ? (
            <View style={[styles.outcome, { borderColor: color.profit }]} accessibilityLiveRegion="polite">
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{done ?? C.done}</Text>
              {signature ? (
                <Pressable onPress={() => void openExternal(txUrl(signature, "mainnet-beta"))} accessibilityRole="link" hitSlop={8}>
                  <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{C.doneTx}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <SignReview
              title={review.title}
              lines={review.lines}
              maxLoss={review.maxLoss}
              confirmLabel={review.confirmLabel}
              onConfirm={onConfirm}
              phase={PHASE[phase]}
              blocker={review.blocker}
              tone={review.tone}
            />
          )}
          {phase === "failed" && problem ? (
            <Text style={[TYPE.body, { color: color.loss }]} accessibilityRole="alert">
              {C.failed(problem)}
            </Text>
          ) : null}
          <Button label={phase === "done" ? "Close" : C.notNow} variant="outline" onPress={onClose} disabled={busy} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  grabber: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, marginTop: 8 },
  body: { padding: SPACE.gutter, paddingTop: 20, paddingBottom: 48, gap: 14 },
  outcome: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
});
