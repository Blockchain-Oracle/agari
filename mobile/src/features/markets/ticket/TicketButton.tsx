import { blockerLabel, type BlockerContext, type BlockerKind } from "@agari/core/copy";
import type { Side } from "@agari/core/types";
import { Pressable, StyleSheet, Text } from "react-native";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { useTk } from "./tk";

export type ButtonTone = "primary" | Side;

/**
 * web's BlockedButton at size lg (the 52 px Ticket CTA): armed, the side's own fill with cream ink (vermilion with
 * white for no side); blocked, the surface-2 face in the disabled ink, and the blocker IS the label.
 */
export function BlockedButton({ blocker, ctx, tone, label, onPress }: { blocker: BlockerKind | null; ctx?: BlockerContext; tone: ButtonTone; label: string; onPress: () => void }) {
  const tk = useTk();
  if (blocker) {
    const why = blockerLabel(blocker, ctx);
    return (
      <Pressable disabled accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel={why} style={[styles.cta, { backgroundColor: tk.blockedBg, borderColor: tk.hairline }]}>
        <Text style={[styles.label, { color: tk.blockedInk }]} numberOfLines={1} adjustsFontSizeToFit>
          {why}
        </Text>
      </Pressable>
    );
  }
  const fill = tone === "up" ? tk.up : tone === "down" ? tk.down : tk.vermilion;
  const ink = tone === "primary" ? tk.onVermilion : tk.ctaSideInk;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.cta, { backgroundColor: fill, borderColor: fill }, pressed && styles.pressed]}
    >
      <Text style={[styles.label, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

/** web's ConnectButton inside the gate: the 48 px vermilion button, sized to its word. */
export function ConnectButton({ label, onPress, busy = false }: { label: string; onPress: () => void; busy?: boolean }) {
  const tk = useTk();
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.connect, { backgroundColor: tk.vermilion }, (pressed || busy) && styles.pressed]}>
      <Text style={[styles.label, { color: tk.onVermilion }]}>{label}</Text>
    </Pressable>
  );
}

/** web's `.tk-gate-cta`: the rounded vermilion action inside a gate. */
export function GateCta({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const tk = useTk();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.gateCta, { backgroundColor: tk.vermilion }, (pressed || disabled) && styles.pressed]}>
      <Text style={[styles.gateLabel, { color: tk.onVermilion }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: { height: 52, borderRadius: 8, borderWidth: 1, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: FONT.bodyMedium, fontSize: 16, lineHeight: 22.5 },
  pressed: { opacity: 0.8 },
  connect: { alignSelf: "flex-start", height: 48, borderRadius: 8, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  gateCta: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 },
  gateLabel: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 19.5 },
});
