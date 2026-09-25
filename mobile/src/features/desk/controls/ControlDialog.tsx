import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { CONTROLS } from "@/features/desk/copy-controls";
import { clock } from "@/features/desk/format";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import { pushToast } from "~/components/toast/store";
import { SITE_URL } from "~/lib/env";
import type { NativeDeskView as DeskView } from "../native-view";
import { DkControl, DT, useDeskTheme } from "../kit";
import { ControlCard } from "./ControlCard";
import { MoneySheet } from "./MoneySheet";
import { ModePicker, type LiveMode } from "./ModePicker";

export type ControlKind = "addMoney" | "withdraw" | "sellAll" | "pause" | "resume" | "mode" | "checkNow" | "share" | "close";
/** A card is good for ten minutes; a Solana blockhash is good for about a minute, so the wallet asks again after that anyway. */
const CARD_TTL_SEC = 600;

interface Props {
  view: DeskView;
  actions: DeskActions;
  kind: ControlKind;
  zone: string | null;
  nowSec: number;
  onClose: () => void;
}

/** One control's card (web's DeskControls.tsx `ControlDialog`), confirmed right there. Keyed by kind, so each opening starts clean. */
export function ControlDialog({ view, actions, kind, zone, nowSec, onClose }: Props) {
  const { color } = useDeskTheme();
  const [openedAtSec] = useState(nowSec);
  const [mode, setMode] = useState<LiveMode>(view.mode === "on_its_own" ? "on_its_own" : "ask_first");
  const [shareOn, setShareOn] = useState(view.wire.desk?.sharePublic ?? false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { state } = actions;
  const common = { expiresAtSec: openedAtSec + CARD_TTL_SEC, nowSec, zone, phase: state.phase, problem: state.problem, signature: state.signature, onClose };
  const shareLink = `${SITE_URL}/desk/${view.wire.desk?.id ?? ""}`;

  if (kind === "addMoney" || kind === "withdraw") return <MoneySheet view={view} actions={actions} kind={kind === "addMoney" ? "deposit" : "withdraw"} zone={zone} nowSec={nowSec} onClose={onClose} />;
  if (kind === "pause") return <ControlCard {...common} title={CONTROLS.pause.title} body={CONTROLS.pause.body} now={[CONTROLS.pause.now(view.stateText)]} after={[CONTROLS.pause.after]} who="wallet" onConfirm={() => void actions.tx("pause", (s) => s.pause())} />;
  if (kind === "resume") return <ControlCard {...common} title={CONTROLS.resume.title} body={CONTROLS.resume.body} now={[CONTROLS.pause.now(view.stateText)]} after={[CONTROLS.resume.after]} who="wallet" onConfirm={() => void actions.tx("unpause", (s) => s.unpause())} />;
  if (kind === "mode") {
    const confirm = async () => {
      const landed = await actions.tx("set-mode", (s) => s.setMode(mode));
      if (landed.ok) await actions.recordMode(mode);
    };
    return (
      <ControlCard {...common} title={CONTROLS.mode.title} body={view.isLive ? CONTROLS.mode.body : CONTROLS.mode.practiceLocked} now={[CONTROLS.mode.now(DESK.modes[view.mode])]} after={[CONTROLS.mode.after(DESK.modes[mode])]} who="wallet" disabled={!view.isLive || mode === view.mode} onConfirm={() => void confirm()}>
        {view.isLive ? <ModePicker value={mode} onChange={setMode} label={CONTROLS.actions.mode} /> : null}
      </ControlCard>
    );
  }
  if (kind === "checkNow") {
    const confirm = async () => {
      const result = await actions.checkNow();
      if (!result.ok && result.status === 429) setNote(CONTROLS.checkNow.throttled(clock(nowSec + 600, zone)));
    };
    return <ControlCard {...common} title={CONTROLS.checkNow.title} body={CONTROLS.checkNow.body} now={[]} after={[CONTROLS.checkNow.after]} who="message" done={note} onConfirm={() => void confirm()} />;
  }
  if (kind === "share") {
    const was = view.wire.desk?.sharePublic ?? false;
    const copy = () => void Clipboard.setStringAsync(shareLink).then(() => setCopied(true));
    return (
      <ControlCard {...common} title={CONTROLS.share.title} body={CONTROLS.share.body} now={[was ? CONTROLS.share.on : CONTROLS.share.off]} after={[shareOn ? CONTROLS.share.on : CONTROLS.share.off]} who="message" disabled={shareOn === was} onConfirm={() => void actions.share(shareOn)}>
        <View style={styles.row}>
          <DkControl label={CONTROLS.share.on} onPress={() => setShareOn(true)} />
          <DkControl label={CONTROLS.share.off} onPress={() => setShareOn(false)} />
          {was ? <DkControl label={copied ? CONTROLS.share.copied : CONTROLS.share.link} onPress={copy} /> : null}
        </View>
        {was ? (
          <Text style={[DT.mono, { color: color.inkSecondary }]} selectable>
            {shareLink}
          </Text>
        ) : null}
      </ControlCard>
    );
  }
  if (kind === "sellAll") {
    const confirm = async () => {
      const result = await actions.requestAction("sell_all");
      if (!result.ok && result.status === 501) setNote(CONTROLS.card.unsupported);
    };
    return <ControlCard {...common} title={CONTROLS.sellAll.title} body={CONTROLS.sellAll.body} now={view.holdings.map((h) => h.name)} after={[CONTROLS.sellAll.after]} who="request" money done={note} onConfirm={() => void confirm()} />;
  }
  const close = async () => {
    const requested = await actions.requestAction("close");
    if (!requested.ok) {
      if (requested.status === 501) setNote(CONTROLS.card.unsupported);
      return;
    }
    const revoked = await actions.tx("revoke", (s) => s.revokeOperator());
    if (revoked.ok) pushToast({ tone: "neutral", title: CONTROLS.close.after });
  };
  return <ControlCard {...common} title={CONTROLS.close.title} body={CONTROLS.close.body} now={[`Desk ${view.stateText}`]} after={[CONTROLS.close.after]} who="wallet" money done={note} onConfirm={() => void close()} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
});
