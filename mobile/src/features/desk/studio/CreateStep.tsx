import type { DeskMandate } from "@agari/core/desk";
import type { Address } from "@agari/core/types";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { practiceCashE6, type StudioDraft } from "@/features/desk/draft";
import { GO_LIVE_CHECKS } from "@/features/desk/protocol";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import type { StudioActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button, ConnectGate } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { GoLive } from "../controls/GoLive";
import { mandateLines } from "../controls/review-lines";
import { ReviewSheet } from "../controls/ReviewSheet";
import { IconTile, Panel, RadioCards } from "../kit";
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
  onCreated: () => void;
  zone: string | null;
  nowSec: number;
}

/**
 * Step 04 (web's CreateStep.tsx): Practice needs no transaction, one signature and the desk exists; Live is Go live's
 * four mainnet steps, offered once the practice rule is met. Editing an existing desk signs a new mandate version.
 */
export function CreateStep({ draft, mandate, owner, view, writes, editing, problems, onCreated, zone, nowSec }: Props) {
  const { color } = useTheme();
  const [choice, setChoice] = useState<"practice" | "live">("practice");
  const [reviewing, setReviewing] = useState<"create" | "edit" | null>(null);
  const exists = view?.exists ?? false;
  const version = (view?.wire.mandate?.version ?? 0) + 1;

  const sign = async (trigger: "create" | "edit") => {
    if (!mandate) return;
    const result = await writes.signMandate({ mandate, version, trigger, ...(exists ? {} : { practiceCashE6: practiceCashE6(draft) }) });
    if (!result.ok) return;
    setReviewing(null);
    writes.reset();
    onCreated();
  };

  if (!owner) return <ConnectGate why={C.connect} />;
  if (problems.length > 0) {
    return (
      <Panel title={C.problems}>
        {problems.map((p) => (
          <Text key={p} style={[TYPE.body, { color: color.loss }]}>
            {p}
          </Text>
        ))}
      </Panel>
    );
  }
  const review = reviewing && mandate ? (
    <ReviewSheet
      visible
      title={reviewing === "edit" ? DESK.studio.edit.title : C.title}
      body={reviewing === "edit" ? DESK.studio.edit.body : C.practice.body}
      onClose={() => {
        writes.reset();
        setReviewing(null);
      }}
      review={{
        title: reviewing === "edit" ? `${DESK.page.mandate.version(version)}` : C.practice.title,
        lines: mandateLines(mandate, exists ? null : practiceCashE6(draft)),
        maxLoss: "$0.00",
        confirmLabel: reviewing === "edit" ? C.apply : C.practice.button,
      }}
      onConfirm={() => void sign(reviewing)}
      phase={writes.state.phase}
      problem={writes.state.problem}
    />
  ) : null;

  if (editing && exists) {
    return (
      <View style={styles.wrap}>
        {mandate ? <Receipt draft={draft} mandate={mandate} /> : null}
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{DESK.studio.edit.body}</Text>
        <Button label={C.apply} size="lg" disabled={!mandate} onPress={() => setReviewing("edit")} />
        {review}
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
          { value: "practice", media: <IconTile level="careful" icon={{ ios: "flask", android: "science" }} />, title: C.practice.title, body: C.practice.body },
          { value: "live", media: <IconTile level="loose" icon={{ ios: "paperplane", android: "rocket_launch" }} />, title: C.live.title, body: C.live.body },
        ]}
      />
      {choice === "practice" ? (
        exists ? (
          <>
            <Text style={[TYPE.body, { color: color.ink }]}>{C.practice.done}</Text>
            <Button label={DESK.studio.firstSteps.open.replace(" →", "")} trailing="→" onPress={() => router.replace("/desk")} />
          </>
        ) : (
          <>
            <Button label={C.practice.button} size="lg" disabled={!mandate} onPress={() => setReviewing("create")} />
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{DESK.network.practice}</Text>
          </>
        )
      ) : view && exists && view.practice.ready ? (
        <GoLive view={view} actions={writes} liveMode={draft.liveMode} zone={zone} nowSec={nowSec} />
      ) : (
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{C.live.needsPractice(GO_LIVE_CHECKS)}</Text>
      )}
      {review}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
});
