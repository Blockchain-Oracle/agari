"use client";

import { Menu } from "@base-ui/react/menu";
import { ArrowDownToLine, Coins, Ellipsis, LogOut, Pause, Play, Plus, RefreshCw, Share2, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { notify } from "@/lib/toast";
import { ControlCard } from "./ControlCard";
import { DESK } from "./copy";
import { DeskDialog } from "./DeskDialog";
import { CONTROLS } from "./copy-controls";
import { COCKPIT } from "./cockpit/copy-cockpit";
import { clock } from "./format";
import { ModePicker, type LiveMode } from "./ModePicker";
import { MoneySheet } from "./MoneySheet";
import type { DeskActions } from "./useDeskWrites";
import type { DeskView } from "./view";

export type ControlKind = "addMoney" | "withdraw" | "sellAll" | "pause" | "resume" | "mode" | "checkNow" | "share" | "close";
/** A card is good for ten minutes; a Solana blockhash is good for about a minute, so the wallet asks again after that anyway. */
const CARD_TTL_SEC = 600;

interface DialogProps {
  view: DeskView;
  actions: DeskActions;
  kind: ControlKind;
  zone: string | null;
  nowSec: number;
  onClose: () => void;
}

/** One control's card, confirmed right there. Keyed by kind, so each opening starts clean. */
function ControlDialog({ view, actions, kind, zone, nowSec, onClose }: DialogProps) {
  const [openedAtSec] = useState(nowSec);
  const [mode, setMode] = useState<LiveMode>(view.mode === "on_its_own" ? "on_its_own" : "ask_first");
  const [shareOn, setShareOn] = useState(view.wire.desk?.sharePublic ?? false);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { state } = actions;
  const common = { expiresAtSec: openedAtSec + CARD_TTL_SEC, nowSec, zone, phase: state.phase, problem: state.problem, signature: state.signature, onClose };
  const deskId = view.wire.desk?.id ?? "";
  const shareLink = typeof window === "undefined" ? `/desk/${deskId}` : `${window.location.origin}/desk/${deskId}`;

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
        {view.isLive && <ModePicker value={mode} onChange={setMode} label={CONTROLS.actions.mode} />}
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
    const copy = () => void navigator.clipboard?.writeText(shareLink).then(() => setCopied(true));
    return (
      <ControlCard {...common} title={CONTROLS.share.title} body={CONTROLS.share.body} now={[view.wire.desk?.sharePublic ? CONTROLS.share.on : CONTROLS.share.off]} after={[shareOn ? CONTROLS.share.on : CONTROLS.share.off]} who="message" disabled={shareOn === (view.wire.desk?.sharePublic ?? false)} onConfirm={() => void actions.share(shareOn)}>
        <div className="dk-card-actions">
          <button type="button" className="dk-control" aria-pressed={shareOn} onClick={() => setShareOn(true)}>{CONTROLS.share.on}</button>
          <button type="button" className="dk-control" aria-pressed={!shareOn} onClick={() => setShareOn(false)}>{CONTROLS.share.off}</button>
          {view.wire.desk?.sharePublic && (
            <button type="button" className="dk-control" onClick={copy}>{copied ? CONTROLS.share.copied : CONTROLS.share.link}</button>
          )}
        </div>
        {view.wire.desk?.sharePublic && <p className="dk-mono dk-break text-ink-secondary">{shareLink}</p>}
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
    if (!requested.ok) return requested.status === 501 ? setNote(CONTROLS.card.unsupported) : undefined;
    const revoked = await actions.tx("revoke", (s) => s.revokeOperator());
    if (revoked.ok) notify.neutral(CONTROLS.close.after);
  };
  return <ControlCard {...common} title={CONTROLS.close.title} body={CONTROLS.close.body} now={[`Desk ${view.stateText}`]} after={[CONTROLS.close.after]} who="wallet" money done={note} onConfirm={() => void close()} />;
}

export interface ControlButton {
  kind: ControlKind;
  label: string;
  tone?: "primary" | "danger";
  icon: ReactNode;
  /** Shown in the toolbar; the rest fold into More. */
  pinned: boolean;
}

/** The owner's controls in the order the page offers them (plan §5.7 item 9); empty for a visitor or a closed desk. */
export function controlButtons(view: DeskView): ControlButton[] {
  const A = CONTROLS.actions;
  if (!view.isOwner || view.state === "closed") return [];
  const paused = view.state === "paused_by_owner" || view.state === "stopped_by_loss_limit";
  if (!view.isLive) {
    return [
      { kind: "checkNow", label: A.checkNow, tone: "primary", icon: <RefreshCw />, pinned: true },
      { kind: "share", label: A.share, icon: <Share2 />, pinned: true },
      { kind: "mode", label: A.mode, icon: <SlidersHorizontal />, pinned: false },
    ];
  }
  return [
    { kind: "addMoney", label: A.addMoney, tone: "primary", icon: <Plus />, pinned: true },
    { kind: "withdraw", label: A.withdraw, icon: <ArrowDownToLine />, pinned: true },
    paused ? { kind: "resume", label: A.resume, icon: <Play />, pinned: true } : { kind: "pause", label: A.pause, icon: <Pause />, pinned: true },
    { kind: "checkNow", label: A.checkNow, icon: <RefreshCw />, pinned: true },
    { kind: "sellAll", label: A.sellAll, icon: <Coins />, pinned: false },
    { kind: "mode", label: A.mode, icon: <SlidersHorizontal />, pinned: false },
    { kind: "share", label: A.share, icon: <Share2 />, pinned: false },
    { kind: "close", label: A.close, tone: "danger", icon: <LogOut />, pinned: false },
  ];
}

/**
 * Item 9 (plan §5.7): the controls as the cockpit's toolbar. Pinned buttons sit in the header, the rest in More; on a
 * phone everything but the first folds into More. Each opens one card; nothing happens until it is confirmed.
 */
export function DeskControls({ view, actions, zone, nowSec, open, setOpen }: { view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number; open: ControlKind | null; setOpen: (kind: ControlKind | null) => void }) {
  const buttons = controlButtons(view);
  if (buttons.length === 0) return null;
  const close = () => {
    actions?.reset();
    setOpen(null);
  };
  return (
    <div className="cp-actions" role="toolbar" aria-label={COCKPIT.actionsAria}>
      {buttons.map((b, i) => (
        <button key={b.kind} type="button" className="cp-action" data-tone={b.tone} data-pinned={b.pinned ? "" : undefined} data-first={i === 0 ? "" : undefined} onClick={() => setOpen(b.kind)} disabled={!actions} data-cursor="hover">
          {b.icon}
          <span>{b.label}</span>
        </button>
      ))}
      <Menu.Root>
        <Menu.Trigger className="cp-action cp-more" disabled={!actions} aria-label={COCKPIT.more}>
          <Ellipsis />
          <span>{COCKPIT.more}</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={8} align="end" className="cp-menu-positioner">
            <Menu.Popup className="cp-menu">
              {buttons.map((b, i) => (
                <Menu.Item key={b.kind} className="cp-menu-item" data-tone={b.tone} data-pinned={b.pinned ? "" : undefined} data-first={i === 0 ? "" : undefined} onClick={() => setOpen(b.kind)}>
                  {b.icon}
                  {b.label}
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <DeskDialog open={open !== null} onOpenChange={(next) => !next && close()} title={open ? CONTROLS.actions[open] : CONTROLS.title}>
        {open && actions && <ControlDialog key={open} view={view} actions={actions} kind={open} zone={zone} nowSec={nowSec} onClose={close} />}
      </DeskDialog>
    </div>
  );
}
