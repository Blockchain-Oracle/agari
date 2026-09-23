import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { CONTROLS, MONEY } from "@/features/desk/copy-controls";
import { clock } from "@/features/desk/format";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button, type QuoteLine } from "~/components/kit";
import { pushToast } from "~/components/toast/store";
import { SITE_URL } from "~/lib/env";
import { TYPE, useTheme } from "~/theme";
import { mainnetBlocker } from "./blocker";
import { MoneySheet } from "./MoneySheet";
import { ModePicker, type LiveMode } from "./ModePicker";
import { said } from "./review-lines";
import { ReviewSheet } from "./ReviewSheet";

export type ControlKind = "addMoney" | "withdraw" | "sellAll" | "pause" | "resume" | "mode" | "checkNow" | "share" | "close";
/** A card is good for ten minutes (web's CARD_TTL_SEC). */
const CARD_TTL_SEC = 600;
const C = CONTROLS.card;
const NOTHING = "$0.00";
const FEE = "1% of each sale";

interface Props {
  view: DeskView;
  actions: DeskActions;
  kind: ControlKind;
  zone: string | null;
  nowSec: number;
  onClose: () => void;
}

/** One control's card (web's DeskControls.tsx `ControlDialog`): Now → After, who signs, when it expires; then the review. */
export function ControlDialog({ view, actions, kind, zone, nowSec, onClose }: Props) {
  const { color } = useTheme();
  const [openedAtSec] = useState(nowSec);
  const [mode, setMode] = useState<LiveMode>(view.mode === "on_its_own" ? "on_its_own" : "ask_first");
  const [shareOn, setShareOn] = useState(view.wire.desk?.sharePublic ?? false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { state } = actions;
  const expiresAtSec = openedAtSec + CARD_TTL_SEC;
  const expired = nowSec > expiresAtSec && state.phase !== "done";
  const deskId = view.wire.desk?.id ?? "";
  const shareLink = `${SITE_URL}/desk/${deskId}`;

  if (kind === "addMoney" || kind === "withdraw") {
    return <MoneySheet view={view} actions={actions} kind={kind === "addMoney" ? "deposit" : "withdraw"} zone={zone} nowSec={nowSec} onClose={onClose} />;
  }

  const lines = (now: string[], after: string[], who: "wallet" | "message" | "request", money = false): QuoteLine[] => [
    ...(now.length > 0 ? [said(C.now, "", now.join(" · "))] : []),
    said(C.after, "", after.join(" · ")),
    said("Who signs", who === "wallet" ? "Transaction" : "Message", money ? `${C.who[who]}. ${MONEY.network}` : C.who[who]),
    { label: "Card expires", value: clock(expiresAtSec, zone) },
  ];
  const sheet = { visible: true, onClose, phase: state.phase, problem: state.problem, signature: state.signature, done: note };
  const block = (extra: string | null) => (expired ? C.expired : extra);

  if (kind === "pause" || kind === "resume") {
    const pause = kind === "pause";
    const copy = pause ? CONTROLS.pause : CONTROLS.resume;
    return (
      <ReviewSheet
        {...sheet}
        title={copy.title}
        body={copy.body}
        review={{
          title: copy.title,
          lines: lines([CONTROLS.pause.now(view.stateText)], [copy.after], "wallet"),
          maxLoss: NOTHING,
          confirmLabel: pause ? "Slide to pause" : "Slide to resume", sendingLabel: "Sending to Solana mainnet…",
          blocker: block(mainnetBlocker(actions)),
        }}
        onConfirm={() => void actions.tx(pause ? "pause" : "unpause", (s) => (pause ? s.pause() : s.unpause()))}
      />
    );
  }

  if (kind === "mode") {
    const confirm = async () => {
      const landed = await actions.tx("set-mode", (s) => s.setMode(mode));
      if (landed.ok) await actions.recordMode(mode);
    };
    const locked = !view.isLive ? CONTROLS.mode.practiceLocked : mode === view.mode ? `${CONTROLS.mode.now(DESK.modes[view.mode])}.` : null;
    return (
      <ReviewSheet
        {...sheet}
        title={CONTROLS.mode.title}
        body={view.isLive ? CONTROLS.mode.body : CONTROLS.mode.practiceLocked}
        review={{
          title: CONTROLS.mode.title,
          lines: lines([CONTROLS.mode.now(DESK.modes[view.mode])], [CONTROLS.mode.after(DESK.modes[view.isLive ? mode : view.mode])], "wallet"),
          maxLoss: NOTHING,
          confirmLabel: "Slide to change the mode", sendingLabel: "Sending to Solana mainnet…",
          blocker: block(locked ?? mainnetBlocker(actions)),
        }}
        onConfirm={() => void confirm()}
      >
        {view.isLive ? <ModePicker value={mode} onChange={setMode} label={CONTROLS.actions.mode} /> : null}
      </ReviewSheet>
    );
  }

  if (kind === "checkNow") {
    const confirm = async () => {
      const result = await actions.checkNow();
      if (!result.ok && result.status === 429) setNote(CONTROLS.checkNow.throttled(clock(nowSec + 600, zone)));
    };
    return (
      <ReviewSheet
        {...sheet}
        title={CONTROLS.checkNow.title}
        body={CONTROLS.checkNow.body}
        review={{ title: CONTROLS.checkNow.title, lines: lines([], [CONTROLS.checkNow.after], "message"), maxLoss: NOTHING, confirmLabel: "Slide to sign", blocker: block(null) }}
        onConfirm={() => void confirm()}
      />
    );
  }

  if (kind === "share") {
    const was = view.wire.desk?.sharePublic ?? false;
    const copy = async () => {
      await Clipboard.setStringAsync(shareLink);
      setCopied(true);
      pushToast({ tone: "neutral", title: CONTROLS.share.copied, description: shareLink });
    };
    return (
      <ReviewSheet
        {...sheet}
        title={CONTROLS.share.title}
        body={CONTROLS.share.body}
        review={{
          title: CONTROLS.share.title,
          lines: lines([was ? CONTROLS.share.on : CONTROLS.share.off], [shareOn ? CONTROLS.share.on : CONTROLS.share.off], "message"),
          maxLoss: NOTHING,
          confirmLabel: "Slide to sign",
          blocker: block(shareOn === was ? `${was ? CONTROLS.share.on : CONTROLS.share.off}.` : null),
        }}
        onConfirm={() => void actions.share(shareOn)}
      >
        <View style={styles.row}>
          <Button label={CONTROLS.share.on} size="sm" block={false} style={styles.grow} variant={shareOn ? "primary" : "outline"} onPress={() => setShareOn(true)} />
          <Button label={CONTROLS.share.off} size="sm" block={false} style={styles.grow} variant={!shareOn ? "primary" : "outline"} onPress={() => setShareOn(false)} />
        </View>
        {was ? (
          <>
            <Text style={[TYPE.data, { color: color.inkSecondary }]} selectable>
              {shareLink}
            </Text>
            <Button label={copied ? CONTROLS.share.copied : CONTROLS.share.link} variant="secondary" icon={{ ios: "doc.on.doc", android: "content_copy" }} onPress={() => void copy()} />
          </>
        ) : null}
      </ReviewSheet>
    );
  }

  if (kind === "sellAll") {
    const confirm = async () => {
      const result = await actions.requestAction("sell_all");
      if (!result.ok && result.status === 501) setNote(C.unsupported);
    };
    return (
      <ReviewSheet
        {...sheet}
        eyebrow={MONEY.eyebrow}
        title={CONTROLS.sellAll.title}
        body={CONTROLS.sellAll.body}
        review={{ title: CONTROLS.sellAll.title, lines: lines(view.holdings.map((h) => h.name), [CONTROLS.sellAll.after], "request", true), maxLoss: FEE, confirmLabel: "Slide to sign the request", blocker: block(null), tone: "loss" }}
        onConfirm={() => void confirm()}
      />
    );
  }

  const close = async () => {
    const requested = await actions.requestAction("close");
    if (!requested.ok) {
      if (requested.status === 501) setNote(C.unsupported);
      return;
    }
    const revoked = await actions.tx("revoke", (s) => s.revokeOperator());
    if (revoked.ok) pushToast({ tone: "neutral", title: CONTROLS.close.after });
  };
  return (
    <ReviewSheet
      {...sheet}
      eyebrow={MONEY.eyebrow}
      title={CONTROLS.close.title}
      body={CONTROLS.close.body}
      review={{ title: CONTROLS.close.title, lines: lines([`Desk ${view.stateText}`], [CONTROLS.close.after], "wallet", true), maxLoss: FEE, confirmLabel: "Slide to close the desk", sendingLabel: "Sending to Solana mainnet…", blocker: block(mainnetBlocker(actions)), tone: "loss" }}
      onConfirm={() => void close()}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
});
