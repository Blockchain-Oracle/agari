import { recoverUnresolved, type RecoveryResult } from "@agari/markets";
import { useUserSession } from "@agari/markets/react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RECOVERY } from "@/features/recovery/copy";
import { Button, Card, EmptyState, haptic, Pill, type PillTone } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { TYPE, useTheme } from "~/theme";

const TONE: Record<RecoveryResult["outcome"], PillTone> = { landed: "profit", reverted: "loss", absent: "neutral", expired: "warning", pending: "neutral", error: "warning" };

function words(result: RecoveryResult): { title: string; description: string } {
  const s = result.record.summary;
  if (result.outcome === "landed") return RECOVERY.landed(s);
  if (result.outcome === "absent") return RECOVERY.absent(s);
  if (result.outcome === "reverted") return RECOVERY.reverted(s);
  if (result.outcome === "expired") return RECOVERY.expired(s);
  if (result.outcome === "pending") return RECOVERY.pending(1);
  return { title: "The chain could not be asked", description: `${s}. Try again shortly.` };
}

/**
 * The same chain check web's WriteRecovery runs when a session opens, on demand: every write this phone's journal
 * still holds open (a send that timed out, an app closed mid-signature) and what the chain says about it.
 */
export function RecoveryPanel() {
  const { color } = useTheme();
  const session = useUserSession();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RecoveryResult[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const check = async () => {
    if (!session) return;
    setBusy(true);
    setFailed(null);
    try {
      const found = await recoverUnresolved(session.submitter.journal, session.address, session.submitter.reconciler, Date.now());
      setResults(found);
      haptic.success();
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "The journal could not be read.");
      haptic.error();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        Ask the chain about any send from this phone that never came back: it says whether each landed, reverted or never arrived. Nothing is re-sent.
      </Text>
      <Button label={busy ? "Asking the chain…" : "Check unfinished sends"} variant="secondary" loading={busy} disabled={!session} onPress={() => void check()} />
      {failed ? <Text style={[TYPE.caption, { color: color.loss }]}>{failed}</Text> : null}
      {results && results.length === 0 ? <EmptyState why="Nothing unfinished." detail="Every send from this phone has its answer from the chain." /> : null}
      {results?.map((r) => {
        const copy = words(r);
        return (
          <Card key={r.record.id}>
            <Pill label={r.outcome} tone={TONE[r.outcome]} dot />
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{copy.title}</Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{copy.description}</Text>
            {r.record.txHash ? (
              <Button label="View transaction" variant="ghost" size="sm" block={false} icon={{ ios: "arrow.up.right", android: "north_east" }} onPress={() => void openExternal(explorerUrl("tx", r.record.txHash!))} />
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
});
