import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, SignReview, type ButtonVariant, type QuoteLine } from "~/components/kit";

/**
 * A write's two taps: the button opens the exact review (the kit's SignReview, with the maximum loss), and only the
 * slide there starts the wallet request. A card tap or a single press never signs.
 */
export function ReviewGate({ cta, variant = "primary", title, lines, maxLoss, confirmLabel, onConfirm, busy, blocker, disabled, tone }: {
  cta: string;
  variant?: ButtonVariant;
  title: string;
  lines: readonly QuoteLine[];
  maxLoss: string | null;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | void;
  busy: boolean;
  /** Blocks the slide and says why (not enough funds, fee still loading). */
  blocker?: string | null;
  /** Keeps the review closed (another write is in flight). */
  disabled?: boolean;
  tone?: "profit" | "loss" | "accent";
}) {
  const [open, setOpen] = useState(false);
  if (!open && !busy) {
    return <Button label={cta} variant={variant} disabled={disabled} onPress={() => setOpen(true)} />;
  }
  return (
    <View style={styles.wrap}>
      <SignReview
        title={title}
        lines={lines}
        maxLoss={maxLoss}
        confirmLabel={confirmLabel}
        phase={busy ? "signing" : "review"}
        blocker={blocker}
        tone={tone}
        onConfirm={() => {
          void Promise.resolve(onConfirm()).finally(() => setOpen(false));
        }}
      />
      {busy ? null : <Button label="Cancel" variant="ghost" size="sm" onPress={() => setOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
});
