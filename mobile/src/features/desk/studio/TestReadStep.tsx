import { deskRecordSchema, type DeskMandate } from "@agari/core/desk";
import type { Address } from "@agari/core/types";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { RECORD } from "@/features/desk/copy-record";
import { draftKey, practiceCashE6, readBack, type StudioDraft } from "@/features/desk/draft";
import { clock } from "@/features/desk/format";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { useDecision, useInvalidateDesk } from "@/features/desk/useDesk";
import type { StudioActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button, Card, ConnectGate, Field } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { mandateLines } from "../controls/review-lines";
import { ReviewSheet } from "../controls/ReviewSheet";
import { Panel, TimelineNode, TONE, toneInk } from "../kit";

const R = DESK.studio.read;
/** While the first check runs, the desk view is refetched this often, for at most this long (web's TestRead.tsx). */
const POLL_MS = 5_000;
const POLL_FOR_SEC = 180;

export interface ReadState {
  status: "idle" | "signing" | "waiting" | "done" | "failed";
  key: string | null;
  requestedAtSec: number | null;
  throttledUntilSec: number | null;
  problem: string | null;
}
export const READ_IDLE: ReadState = { status: "idle", key: null, requestedAtSec: null, throttledUntilSec: null, problem: null };

/** The five things one check does, lit as the read goes (web's `ReadStream`, an agent activity stream). */
function ReadStream({ status }: { status: ReadState["status"] }) {
  const { color } = useTheme();
  const T = STUDIO.read;
  const working = status === "signing" || status === "waiting";
  return (
    <Panel title={status === "done" ? T.done : working ? T.working : T.streamTitle}>
      <View accessibilityLiveRegion="polite">
        {T.steps.map((line, i) => {
          const done = status === "done" || (status === "waiting" && i === 0);
          const active = (status === "signing" && i === 0) || (status === "waiting" && i > 0);
          return (
            <TimelineNode key={line} index={i} tone={done ? "acted" : "neutral"} last={i === T.steps.length - 1} icon={done ? undefined : active ? { ios: "hourglass", android: "hourglass_top" } : undefined}>
              <Text style={[TYPE.body, { color: done ? color.ink : active ? color.accent : color.inkMuted }]}>{line}</Text>
            </TimelineNode>
          );
        })}
      </View>
    </Panel>
  );
}

interface Props {
  draft: StudioDraft;
  setDraft: (update: (d: StudioDraft) => StudioDraft) => void;
  mandate: DeskMandate | null;
  owner: Address | null;
  view: DeskView | null;
  writes: StudioActions;
  read: ReadState;
  setRead: (read: ReadState) => void;
  zone: string | null;
  nowSec: number;
}

/**
 * Step 03 (web's TestRead.tsx): "Read my basket now". Signing the mandate starts the practice desk (or applies a new
 * version) and asks it to check now; the first decision appears when the runner has written it, then the read-back.
 */
export function TestReadStep({ draft, setDraft, mandate, owner, view, writes, read, setRead, zone, nowSec }: Props) {
  const { color } = useTheme();
  const invalidate = useInvalidateDesk();
  const [reviewing, setReviewing] = useState(false);
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
    setReviewing(false);
    writes.reset();
    const throttled = typeof result.body.throttledUntilSec === "number" ? result.body.throttledUntilSec : null;
    setRead({ status: "waiting", key: draftKey(draft), requestedAtSec: Math.floor(Date.now() / 1000), throttledUntilSec: throttled, problem: null });
  };

  const deskKey = view?.wire.desk?.id ?? null;
  const decision = useDecision(read.status === "done" && latest ? deskKey : null, latest?.seq ?? null, owner);
  const body = decision?.ok ? deskRecordSchema.safeParse(decision.value.record.body) : null;
  const warnings = body?.success ? (body.data.timing?.decision?.warnings ?? []) : [];
  const stale = read.key !== null && read.key !== draftKey(draft);
  const busy = read.status === "signing" || (read.status === "waiting" && !stale);

  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{R.body}</Text>
      <ReadStream status={read.status} />
      {exists ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{R.exists}</Text> : null}
      {!exists ? <Field label={R.practiceCash} value={draft.practiceCash} onChangeText={(practiceCash) => setDraft((d) => ({ ...d, practiceCash }))} numeric suffix="USDC" /> : null}
      {!exists ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{R.practiceCashNote}</Text> : null}
      <ConnectGate why={R.connect}>
        <Button label={read.status === "signing" ? R.signing : read.status === "done" || stale ? R.again : R.run} disabled={!mandate || busy} loading={read.status === "signing"} onPress={() => setReviewing(true)} />
        {read.status === "waiting" ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{read.throttledUntilSec ? R.throttled(clock(read.throttledUntilSec, zone)) : R.waiting}</Text> : null}
        {read.status === "failed" ? <Text style={[TYPE.caption, { color: color.loss }]}>{read.problem ?? R.failed}</Text> : null}
      </ConnectGate>
      {read.status === "done" && latest ? (
        <Card onPress={deskKey ? () => router.push(`/desk/${deskKey}/decision/${latest.seq}`) : undefined} accessibilityLabel={`${R.first}: ${latest.summary}`}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{R.first}</Text>
          <Text style={[TYPE.bodyStrong, { color: toneInk(TONE[latest.outcome], color) }]}>
            {RECORD.outcome[latest.outcome]}
            {latest.mode === "practice" ? ` · ${RECORD.list.practiceTag}` : ""} · #{latest.seq} →
          </Text>
          <Text style={[TYPE.body, { color: color.ink }]}>{latest.summary}</Text>
        </Card>
      ) : null}
      {mandate && (read.status === "done" || read.status === "waiting") ? (
        <Panel title={R.heard}>
          {readBack(mandate).map((line) => (
            <Text key={line} style={[TYPE.body, { color: color.inkSecondary }]}>
              {line}
            </Text>
          ))}
          {warnings.length > 0 ? <Text style={[TYPE.labelMicro, { color: color.accent }]}>{R.question}</Text> : null}
          {warnings.map((w) => (
            <Text key={w} style={[TYPE.body, { color: color.ink }]}>
              {w}
            </Text>
          ))}
        </Panel>
      ) : null}
      {reviewing && mandate && owner ? (
        <ReviewSheet
          visible
          title={R.title}
          body={R.body}
          onClose={() => {
            writes.reset();
            setReviewing(false);
            if (read.status === "signing" || read.status === "failed") setRead(READ_IDLE);
          }}
          review={{
            title: exists ? DESK.studio.edit.kicker : R.title,
            lines: mandateLines(mandate, exists ? null : practiceCashE6(draft)),
            maxLoss: "$0.00",
            confirmLabel: "Slide to sign the mandate",
          }}
          onConfirm={() => void run()}
          phase={writes.state.phase}
          problem={writes.state.problem}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
});
