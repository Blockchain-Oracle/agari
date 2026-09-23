import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { haptic, SignReview, type QuoteLine, type SignPhase } from "~/components/kit";
import { SPACE, TYPE, useTheme } from "~/theme";

export interface ReviewRequest {
  /** What is being signed, in one line. */
  title: string;
  lines: readonly QuoteLine[];
  maxLoss: string | null;
  confirmLabel: string;
  tone?: "profit" | "loss" | "accent";
  blocker?: string | null;
  /**
   * Sends the write through web's own hook: true once the chain confirmed it, false when it was refused, null when
   * the hook reports only by toast (web's close/settle/claim), so the sheet steps aside for that toast.
   */
  send: () => Promise<boolean | null>;
}

/** Held long enough for the "done" slide state to register before the sheet slides away. */
const DONE_HOLD_MS = 650;

/**
 * The page sheet every Trade write passes through (kit `SignReview` inside a native sheet): the exact quote the
 * transaction is built from, the maximum loss, then a deliberate slide. The sheet closes once the send settles
 * either way: a confirmed one after a beat, a refused one at once so web's toast (drawn beneath) says why.
 */
export function ReviewSheet({ request, onClose }: { request: ReviewRequest | null; onClose: () => void }) {
  const { color } = useTheme();
  const [phase, setPhase] = useState<SignPhase>("review");
  useEffect(() => {
    if (request) setPhase("review");
  }, [request]);

  const confirm = async () => {
    if (!request) return;
    setPhase("signing");
    let ok: boolean | null = false;
    try {
      ok = await request.send();
    } catch {
      ok = false;
    }
    if (ok === null) {
      onClose();
      return;
    }
    if (ok) {
      haptic.success();
      setPhase("done");
      setTimeout(onClose, DONE_HOLD_MS);
      return;
    }
    // Web's hook has toasted the reason; the toaster draws under this sheet, so the sheet steps aside for it.
    haptic.error();
    setPhase("failed");
    onClose();
  };

  const busy = phase === "signing" || phase === "sending";
  return (
    <Modal
      visible={request !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={busy ? undefined : onClose}
    >
      <View style={[styles.sheet, { backgroundColor: color.ground }]}>
        <View style={styles.head}>
          <Pressable
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={12}
            style={styles.cancel}
          >
            <Text style={[TYPE.bodyStrong, { color: busy ? color.inkDisabled : color.accent }]}>Cancel</Text>
          </Pressable>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>Review before you sign</Text>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {request ? (
            <SignReview
              title={request.title}
              lines={request.lines}
              maxLoss={request.maxLoss}
              confirmLabel={request.confirmLabel}
              onConfirm={() => void confirm()}
              phase={phase}
              blocker={request.blocker}
              tone={request.tone}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.gutter,
    paddingTop: 18,
    paddingBottom: 8,
  },
  cancel: { minHeight: 44, justifyContent: "center" },
  body: { padding: SPACE.gutter, paddingBottom: 48, gap: 16 },
});
