import type { PrintWhich, ReplayState } from "@agari/markets";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PROOF } from "@/features/proof/copy";
import { haptic } from "~/components/kit";
import { SITE_URL } from "~/lib/env";
import { FONT, useTheme } from "~/theme";

type RefusalCode = keyof typeof PROOF.replayRefused;

/**
 * web's ReverifyButton.tsx — shadcn's secondary `xs` Button: asks the server to post the archived update again as
 * `proof-replay` (POST /api/proof/pyth, idempotent per boundary, quota-limited), then the proof read polls every 3 s
 * until the row settles.
 */
export function ReverifyButton({ marketId, which, state, onStarted }: { marketId: string; which: PrintWhich; state: ReplayState | null; onStarted: () => void }) {
  const { color } = useTheme();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const posting = state === "posting";
  // An open verified account is its own proof; a closed or failed one can be posted again.
  const disabled = busy || posting || state === "verified";

  const start = async () => {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch(`${SITE_URL}/api/proof/pyth`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ market: marketId, which }) });
      if (response.ok) {
        haptic.success();
        onStarted();
        return;
      }
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      const code = (body?.code && body.code in PROOF.replayRefused ? body.code : "failed") as RefusalCode;
      setNote(PROOF.replayRefused[code]);
    } catch {
      setNote(PROOF.replayRefused.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => void start()}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: busy || posting }}
        style={({ pressed }) => [styles.button, { backgroundColor: color.surface2 }, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={[styles.label, { color: color.ink }]}>{busy || posting ? PROOF.reverifying : PROOF.reverify}</Text>
      </Pressable>
      {note ? (
        <Text style={[styles.note, { color: color.warning }]} accessibilityRole="alert">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 1 },
  button: { height: 32, paddingHorizontal: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ translateY: 1 }] },
  label: { fontFamily: FONT.bodyMedium, fontSize: 12, lineHeight: 16 },
  note: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
});
