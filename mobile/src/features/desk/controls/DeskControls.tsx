import { ArrowDownToLine, Coins, Ellipsis, LogOut, Pause, Play, Plus, RefreshCw, Share2, SlidersHorizontal, type LucideIcon } from "lucide-react-native";
import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { CONTROLS } from "@/features/desk/copy-controls";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { CpAction, useDeskTheme } from "../kit";
import { ControlDialog, type ControlKind } from "./ControlDialog";
import { DeskDialog } from "./DeskDialog";

interface ControlButton {
  kind: ControlKind;
  label: string;
  tone?: "primary" | "danger";
  icon: LucideIcon;
}

/** The owner's controls in web's order (DeskControls.tsx `controlButtons`); none for a visitor or a closed desk. */
function controlButtons(view: DeskView): ControlButton[] {
  const A = CONTROLS.actions;
  if (!view.isOwner || view.state === "closed") return [];
  const paused = view.state === "paused_by_owner" || view.state === "stopped_by_loss_limit";
  if (!view.isLive) {
    return [
      { kind: "checkNow", label: A.checkNow, tone: "primary", icon: RefreshCw },
      { kind: "share", label: A.share, icon: Share2 },
      { kind: "mode", label: A.mode, icon: SlidersHorizontal },
    ];
  }
  return [
    { kind: "addMoney", label: A.addMoney, tone: "primary", icon: Plus },
    { kind: "withdraw", label: A.withdraw, icon: ArrowDownToLine },
    paused ? { kind: "resume", label: A.resume, icon: Play } : { kind: "pause", label: A.pause, icon: Pause },
    { kind: "checkNow", label: A.checkNow, icon: RefreshCw },
    { kind: "sellAll", label: A.sellAll, icon: Coins },
    { kind: "mode", label: A.mode, icon: SlidersHorizontal },
    { kind: "share", label: A.share, icon: Share2 },
    { kind: "close", label: A.close, tone: "danger", icon: LogOut },
  ];
}

/** `.cp-menu`: the More popup under its trigger, aligned to its right edge, 8 px below. */
function MoreMenu({ items, anchor, onPick, onClose }: { items: ControlButton[]; anchor: { x: number; y: number; w: number; h: number }; onPick: (k: ControlKind) => void; onClose: () => void }) {
  const { color, t } = useDeskTheme();
  const { width } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <Animated.View
        entering={FadeIn.duration(140)}
        accessibilityRole="menu"
        style={[styles.menu, { top: anchor.y + anchor.h + 8, right: Math.max(8, width - anchor.x - anchor.w), backgroundColor: color.surface1, borderColor: color.hairline, boxShadow: `0 16px 40px ${t.shadow}` }]}
      >
        {items.map((b) => {
          const danger = b.tone === "danger";
          const ink = danger ? color.loss : color.ink;
          return (
            <Pressable key={b.kind} onPress={() => onPick(b.kind)} accessibilityRole="menuitem" style={({ pressed }) => [styles.item, pressed && { backgroundColor: color.surface2 }]}>
              <b.icon size={16} color={danger ? color.loss : color.inkSecondary} />
              <Text style={[styles.itemText, { color: ink }]}>{b.label}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

/**
 * The owner's toolbar (web's DeskControls.tsx at ≤ 720 px): the first control stays in the head, everything else folds
 * into More. Each opens one card in the bottom sheet; nothing happens until it is confirmed. A visitor sees nothing,
 * an owner without a signing wallet sees the controls disabled.
 */
export function DeskControls({ view, actions, nowSec, zone }: { view: DeskView; actions: DeskActions | null; nowSec: number; zone: string | null }) {
  const [open, setOpen] = useState<ControlKind | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const more = useRef<View>(null);
  const buttons = controlButtons(view);
  if (buttons.length === 0) return null;
  const [first, ...rest] = buttons as [ControlButton, ...ControlButton[]];
  const close = () => {
    actions?.reset();
    setOpen(null);
  };
  const pick = (kind: ControlKind) => {
    haptic.select();
    setMenu(null);
    setOpen(kind);
  };
  return (
    <View style={styles.actions} accessibilityRole="toolbar" accessibilityLabel={COCKPIT.actionsAria}>
      <CpAction label={first.label} tone={first.tone} icon={first.icon} disabled={!actions} onPress={() => pick(first.kind)} />
      <View ref={more} collapsable={false}>
        <CpAction label={COCKPIT.more} icon={Ellipsis} disabled={!actions} onPress={() => more.current?.measureInWindow((x, y, w, h) => setMenu({ x, y, w, h }))} />
      </View>
      {menu ? <MoreMenu items={rest} anchor={menu} onPick={pick} onClose={() => setMenu(null)} /> : null}
      <DeskDialog open={open !== null} onClose={close} title={open ? CONTROLS.actions[open] : CONTROLS.title}>
        {open && actions ? <ControlDialog key={open} view={view} actions={actions} kind={open} zone={zone} nowSec={nowSec} onClose={close} /> : null}
      </DeskDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 8 },
  menu: { position: "absolute", minWidth: 200, padding: 6, borderWidth: 1, borderRadius: 14 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 9 },
  itemText: { fontFamily: FONT.bodyStrong, fontSize: 13.5 },
});
