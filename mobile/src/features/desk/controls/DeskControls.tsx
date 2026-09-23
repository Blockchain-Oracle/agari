import type { SymbolViewProps } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { CONTROLS } from "@/features/desk/copy-controls";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button } from "~/components/kit";
import { Panel } from "../kit";
import { ControlDialog, type ControlKind } from "./ControlDialog";

interface ControlButton {
  kind: ControlKind;
  label: string;
  tone?: "primary" | "danger";
  icon: SymbolViewProps["name"];
}

/** The owner's controls in the order web offers them (DeskControls.tsx `controlButtons`); none for a visitor or a closed desk. */
function controlButtons(view: DeskView): ControlButton[] {
  const A = CONTROLS.actions;
  if (!view.isOwner || view.state === "closed") return [];
  const paused = view.state === "paused_by_owner" || view.state === "stopped_by_loss_limit";
  if (!view.isLive) {
    return [
      { kind: "checkNow", label: A.checkNow, tone: "primary", icon: { ios: "arrow.clockwise", android: "refresh" } },
      { kind: "share", label: A.share, icon: { ios: "square.and.arrow.up", android: "share" } },
      { kind: "mode", label: A.mode, icon: { ios: "slider.horizontal.3", android: "tune" } },
    ];
  }
  return [
    { kind: "addMoney", label: A.addMoney, tone: "primary", icon: { ios: "plus", android: "add" } },
    { kind: "withdraw", label: A.withdraw, icon: { ios: "arrow.down.to.line", android: "download" } },
    paused ? { kind: "resume", label: A.resume, icon: { ios: "play", android: "play_arrow" } } : { kind: "pause", label: A.pause, icon: { ios: "pause", android: "pause" } },
    { kind: "checkNow", label: A.checkNow, icon: { ios: "arrow.clockwise", android: "refresh" } },
    { kind: "sellAll", label: A.sellAll, icon: { ios: "dollarsign.circle", android: "paid" } },
    { kind: "mode", label: A.mode, icon: { ios: "slider.horizontal.3", android: "tune" } },
    { kind: "share", label: A.share, icon: { ios: "square.and.arrow.up", android: "share" } },
    { kind: "close", label: A.close, tone: "danger", icon: { ios: "rectangle.portrait.and.arrow.right", android: "logout" } },
  ];
}

/**
 * The owner's controls (web's DeskControls.tsx toolbar, folded for a phone into one panel of buttons). Each opens its
 * card as a sheet; nothing happens until the review is slid.
 */
export function DeskControls({ view, actions, nowSec, zone }: { view: DeskView; actions: DeskActions | null; nowSec: number; zone: string | null }) {
  const [open, setOpen] = useState<ControlKind | null>(null);
  const buttons = controlButtons(view);
  if (buttons.length === 0 || !actions) return null;
  const close = () => {
    actions.reset();
    setOpen(null);
  };
  const [first, ...rest] = buttons;
  return (
    <Panel title={CONTROLS.title}>
      {first ? <Button label={first.label} icon={first.icon} onPress={() => setOpen(first.kind)} /> : null}
      <View style={styles.grid}>
        {rest.map((b) => (
          <Button
            key={b.kind}
            label={b.label}
            icon={b.icon}
            size="sm"
            variant={b.tone === "danger" ? "destructive" : "secondary"}
            block={false}
            style={styles.cell}
            onPress={() => setOpen(b.kind)}
          />
        ))}
      </View>
      {open ? <ControlDialog key={open} view={view} actions={actions} kind={open} zone={zone} nowSec={nowSec} onClose={close} /> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { flexBasis: "47%", flexGrow: 1 },
});
