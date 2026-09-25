import { deskRecordSchema, type DeskMandate } from "@agari/core/desk";
import type { Address } from "@agari/core/types";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { draftKey, practiceCashE6, readBack, type StudioDraft } from "@/features/desk/draft";
import { clock } from "@/features/desk/format";
import { useDecision, useInvalidateDesk } from "@/features/desk/useDesk";
import type { StudioActions } from "@/features/desk/useDeskWrites";
import { FONT, useTheme } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { DkCard, Outcome, StBtn, StHint, StLabel, T } from "./kit-bits";
import { ReadStream, type ReadStatus } from "./ReadStream";

const R = DESK.studio.read;
/** While the first check runs, the desk view is refetched this often, for at most this long. */
const POLL_MS = 5_000;
const POLL_FOR_SEC = 180;

export interface ReadState {
  status: ReadStatus;
  key: string | null;
  requestedAtSec: number | null;
  throttledUntilSec: number | null;
  problem: string | null;
}
export const READ_IDLE: ReadState = { status: "idle", key: null, requestedAtSec: null, throttledUntilSec: null, problem: null };

interface Props {
  draft: StudioDraft;
  setDraft: (update: (d: StudioDraft) => StudioDraft) => void;
  mandate: DeskMandate | null;
  owner: Address | null;
  view: DeskView | null;
  writes: StudioActions;
  read: ReadState;
  setRead: (read: ReadState) => void;
  onConnect: () => void;
  zone: string | null;
  nowSec: number;
}

/**
 * Step 03 (web's TestRead.tsx): "Read my basket now". The button asks the wallet to sign the mandate (the wallet's
 * prompt is the confirmation), which starts the practice desk or applies a new version and asks it to check now; the
 * first decision appears when the runner has written it, then the read-back with the desk's one question.
 */
export function TestRead({ draft, setDraft, mandate, owner, view, writes, read, setRead, onConnect, zone, nowSec }: Props) {
  const { color } = useTheme();
  const invalidate = useInvalidateDesk();
  const exists = view?.exists ?? false;
  const latest = view?.wire.latest ?? null;
  const arrived = read.status === "waiting" && latest !== null && read.requestedAtSec !== null && latest.decidedAtSec >= read.requestedAtSec - 30;
  useEffect(() => {
    if (read.status !== "waiting" || arrived) return;
    if (read.requestedAtSec !== null && nowSec - read.requestedAtSec > POLL_FOR_SEC) return;
    const id = setInterval(() => void invalidate(), POLL_MS);
    return () => clearInterval(id);
  }, [read.status, read.requestedAtSec, arrived, nowSec, invalidate]);
  useEffect(() => {
    if (arrived) setRead({ ...read, status: "done" });
  }, [arrived, read, setRead]);

  const run = async () => {
    if (!mandate) return;
    setRead({ ...READ_IDLE, status: "signing", key: draftKey(draft) });
    const result = await writes.signMandate({ mandate, version: (view?.wire.mandate?.version ?? 0) + 1, trigger: "test_read", ...(exists ? {} : { practiceCashE6: practiceCashE6(draft) }) });
    if (!result.ok) return setRead({ ...READ_IDLE, status: "failed", problem: result.reason });
    const throttled = typeof result.body.throttledUntilSec === "number" ? result.body.throttledUntilSec : null;
    setRead({ status: "waiting", key: draftKey(draft), requestedAtSec: Math.floor(Date.now() / 1000), throttledUntilSec: throttled, problem: null });
  };

  const deskKey = view?.wire.desk?.id ?? null;
  const decision = useDecision(read.status === "done" && latest ? deskKey : null, latest?.seq ?? null, owner);
  const body = decision?.ok ? deskRecordSchema.safeParse(decision.value.record.body) : null;
  const warnings = body?.success ? (body.data.timing?.decision?.warnings ?? []) : [];
  const stale = read.key !== null && read.key !== draftKey(draft);

  return (
    <View style={styles.wrap}>
      <Text style={[T.body, { color: color.inkSecondary }]}>{R.body}</Text>
      <ReadStream status={read.status} />
      {exists ? <Text style={[T.caption, { color: color.inkMuted }]}>{R.exists}</Text> : null}
      {!exists ? (
        <View style={styles.block}>
          <StLabel>{R.practiceCash}</StLabel>
          <View style={styles.money}>
            <Text style={[styles.dollar, { color: color.inkMuted }]}>$</Text>
            <TextInput
              value={draft.practiceCash}
              onChangeText={(practiceCash) => setDraft((d) => ({ ...d, practiceCash }))}
              keyboardType="decimal-pad"
              accessibilityLabel={R.practiceCash}
              style={[styles.input, { borderColor: color.hairline, backgroundColor: color.ground, color: color.ink }]}
            />
          </View>
          <StHint>{R.practiceCashNote}</StHint>
        </View>
      ) : null}
      {!owner ? (
        <View style={styles.actions}>
          <Text style={[T.caption, { color: color.inkSecondary }]}>{R.connect}</Text>
          <StBtn label="Connect" primary onPress={onConnect} />
        </View>
      ) : (
        <View style={styles.actions}>
          <StBtn
            label={read.status === "signing" ? R.signing : read.status === "done" || stale ? R.again : R.run}
            primary
            onPress={() => void run()}
            disabled={!mandate || read.status === "signing" || (read.status === "waiting" && !stale)}
          />
          {read.status === "waiting" ? <Text style={[T.caption, { color: color.inkSecondary }]}>{read.throttledUntilSec ? R.throttled(clock(read.throttledUntilSec, zone)) : R.waiting}</Text> : null}
          {read.status === "failed" ? <Text style={[T.caption, { color: color.warning }]}>{read.problem ?? R.failed}</Text> : null}
        </View>
      )}
      {read.status === "done" && latest ? (
        <DkCard first>
          <StLabel>{R.first}</StLabel>
          <View style={styles.entryHead}>
            <Outcome outcome={latest.outcome} practice={latest.mode === "practice"} />
            {deskKey ? (
              <Text style={[T.caption, { color: color.accent }]} onPress={() => router.push(`/desk/${deskKey}/decision/${latest.seq}`)} accessibilityRole="link">
                #{latest.seq} →
              </Text>
            ) : null}
          </View>
          <Text style={[T.body, { color: color.ink }]}>{latest.summary}</Text>
        </DkCard>
      ) : null}
      {mandate && (read.status === "done" || read.status === "waiting") ? (
        <DkCard>
          <StLabel>{R.heard}</StLabel>
          {readBack(mandate).map((line) => (
            <Text key={line} style={[T.body, { color: color.inkSecondary }]}>
              {line}
            </Text>
          ))}
          {warnings.length > 0 ? <StLabel>{R.question}</StLabel> : null}
          {warnings.map((w) => (
            <Text key={w} style={[T.body, { color: color.ink }]}>
              {w}
            </Text>
          ))}
        </DkCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  block: { gap: 12 },
  money: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 240 },
  dollar: { fontFamily: FONT.dataRegular, fontSize: 14 },
  input: { flex: 1, minHeight: 44, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, fontFamily: FONT.dataRegular, fontSize: 14 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  entryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
});
