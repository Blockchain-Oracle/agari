import type { PrintWhich, ReplayState } from "@agari/markets";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PROOF } from "@/features/proof/copy";
import { Button, haptic } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

type RefusalCode = keyof typeof PROOF.replayRefused;

/**
 * web's `ReverifyButton` (features/proof/ReverifyButton.tsx): asks the server to post the archived Pyth update to the
 * devnet receiver again (POST /api/proof/pyth — idempotent, quota-limited, no wallet and no funds involved), then the
 * proof read polls every 3 s until the row settles.
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
      const response = await fetch("/api/proof/pyth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ market: marketId, which }),
      });
      if (response.ok) {
        haptic.success();
        onStarted();
        return;
      }
      const body = (await response.json().catch(() => null)) as { code?: string } | null;
      const code = (body?.code && body.code in PROOF.replayRefused ? body.code : "failed") as RefusalCode;
      setNote(PROOF.replayRefused[code]);
      haptic.error();
    } catch {
      setNote(PROOF.replayRefused.failed);
      haptic.error();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Button
        label={busy || posting ? PROOF.reverifying : PROOF.reverify}
        variant="secondary"
        size="sm"
        block={false}
        icon={{ ios: "checkmark.shield", android: "verified_user" }}
        loading={busy || posting}
        disabled={disabled}
        onPress={() => void start()}
      />
      {note ? (
        <Text style={[TYPE.caption, { color: color.warning }]} accessibilityRole="alert">
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: 6, alignItems: "flex-start" } });
