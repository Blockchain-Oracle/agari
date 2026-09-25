import type { DeskMandate } from "@agari/core/desk";
import type { Address } from "@agari/core/types";
import { router } from "expo-router";
import { FlaskConical, Rocket } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { practiceCashE6, type StudioDraft } from "@/features/desk/draft";
import { GO_LIVE_CHECKS } from "@/features/desk/protocol";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import type { StudioActions } from "@/features/desk/useDeskWrites";
import { useTheme } from "~/theme";
import { GoLive } from "../controls/GoLive";
import type { NativeDeskView as DeskView } from "../native-view";
import { DkCard, IconTile, StBtn, StLabel, T } from "./kit-bits";
import { RadioCards } from "./kit-radio";
import { Receipt } from "./Receipt";

const C = DESK.studio.create;

interface Props {
  draft: StudioDraft;
  mandate: DeskMandate | null;
  owner: Address | null;
  view: DeskView | null;
  writes: StudioActions;
  editing: boolean;
  problems: string[];
  onConnect: () => void;
  onCreated: () => void;
  zone: string | null;
  nowSec: number;
}

/**
 * Step 04 (web's CreateStep.tsx): Practice needs no transaction, one signature and the desk exists; Live is Go live's
 * mainnet steps, offered once the practice rule is met. Editing an existing desk signs a new mandate version. The
 * button asks the wallet directly; its prompt is the confirmation.
 */
export function CreateStep({ draft, mandate, owner, view, writes, editing, problems, onConnect, onCreated, zone, nowSec }: Props) {
  const { color } = useTheme();
  const [choice, setChoice] = useState<"practice" | "live">("practice");
  const [problem, setProblem] = useState<string | null>(null);
  const busy = writes.state.busy === "mandate";
  const exists = view?.exists ?? false;
  const version = (view?.wire.mandate?.version ?? 0) + 1;

  const sign = async (trigger: "create" | "edit") => {
    if (!mandate) return;
    setProblem(null);
    const result = await writes.signMandate({ mandate, version, trigger, ...(exists ? {} : { practiceCashE6: practiceCashE6(draft) }) });
    if (!result.ok) return setProblem(result.reason);
    onCreated();
  };

  if (!owner) {
    return (
      <View style={styles.actions}>
        <Text style={[T.caption, { color: color.inkSecondary }]}>{C.connect}</Text>
        <StBtn label="Connect" primary onPress={onConnect} />
      </View>
    );
  }
  if (problems.length > 0) {
    return (
      <DkCard>
        <StLabel>{C.problems}</StLabel>
        {problems.map((p) => (
          <Text key={p} style={[T.body, { color: color.warning }]}>
            {p}
          </Text>
        ))}
      </DkCard>
    );
  }
  if (editing && exists) {
    return (
      <View style={styles.edit}>
        <Text style={[T.body, { color: color.inkSecondary }]}>{DESK.studio.edit.body}</Text>
        <View style={styles.actions}>
          <StBtn label={busy ? DESK.studio.read.signing : C.apply} primary onPress={() => void sign("edit")} disabled={busy || !mandate} />
          {problem ? <Text style={[T.caption, { color: color.warning }]}>{problem}</Text> : null}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {mandate ? <Receipt draft={draft} mandate={mandate} /> : null}
      <RadioCards
        value={choice}
        onChange={setChoice}
        label={STUDIO.receipt.modeAria}
        items={[
          { value: "practice", media: <IconTile icon={FlaskConical} level="careful" />, title: C.practice.title, body: C.practice.body },
          { value: "live", media: <IconTile icon={Rocket} level="loose" />, title: C.live.title, body: C.live.body },
        ]}
      />
      {choice === "practice" ? (
        exists ? (
          <View style={styles.actions}>
            <Text style={[T.body, { color: color.ink }]}>{C.practice.done}</Text>
            <StBtn label={DESK.studio.firstSteps.open} primary onPress={() => router.push("/desk")} />
          </View>
        ) : (
          <View style={styles.actions}>
            <StBtn label={busy ? DESK.studio.read.signing : C.practice.button} primary lg onPress={() => void sign("create")} disabled={busy || !mandate} />
            <Text style={[T.caption, { color: color.inkMuted }]}>{DESK.network.practice}</Text>
            {problem ? <Text style={[T.caption, { color: color.warning }]}>{problem}</Text> : null}
          </View>
        )
      ) : view && exists && view.practice.ready ? (
        <GoLive view={view} actions={writes} liveMode={draft.liveMode} zone={zone} nowSec={nowSec} />
      ) : (
        <Text style={[T.body, { color: color.inkSecondary }]}>{C.live.needsPractice(GO_LIVE_CHECKS)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  edit: { gap: 16 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
});
