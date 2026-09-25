import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CONTROLS, MONEY } from "@/features/desk/copy-controls";
import { stamp } from "@/features/desk/format";
import type { DeskPhase } from "@/features/desk/useDeskWrites";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { DkControl, DT, useDeskTheme } from "../kit";

export interface ControlCardProps {
  title: string;
  body: string;
  now: string[];
  after: string[];
  who: "wallet" | "message" | "request";
  /** Money can move: the network is named on the card. */
  money?: boolean;
  expiresAtSec: number;
  nowSec: number;
  zone: string | null;
  phase: DeskPhase;
  problem: string | null;
  signature: Signature | null;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
  disabled?: boolean;
  done?: string | null;
  children?: ReactNode;
}

/**
 * web's ControlCard.tsx inside the dialog (its own frame dropped): what changes, Now → After, who signs, when the card
 * expires. Nothing happens until Confirm, which asks the wallet directly; the outcome is written on the same card.
 */
export function ControlCard(p: ControlCardProps) {
  const { color } = useDeskTheme();
  const C = CONTROLS.card;
  const expired = p.nowSec > p.expiresAtSec && p.phase !== "done";
  const busy = p.phase === "signing" || p.phase === "sending" || p.phase === "confirming";
  const single = p.now.length === 0;
  return (
    <View style={styles.card}>
      {p.money ? <Text style={[DT.eyebrow, styles.clearClose, { color: color.accent }]}>{MONEY.eyebrow}</Text> : null}
      <Text style={[DT.holdingName, !p.money && styles.clearClose, { color: color.ink }]} accessibilityRole="header">
        {p.title}
      </Text>
      <Text style={[DT.caption, { color: color.inkSecondary }]}>{p.body}</Text>
      {p.children}
      {p.now.length > 0 || p.after.length > 0 ? (
        <View style={styles.diff}>
          {!single ? (
            <View style={styles.diffCol}>
              <Text style={[styles.dt, { color: color.inkMuted }]}>{C.now}</Text>
              {p.now.map((line) => (
                <Text key={`n-${line}`} style={[styles.dd, { color: color.inkSecondary }]}>{line}</Text>
              ))}
            </View>
          ) : null}
          <View style={styles.diffCol}>
            <Text style={[styles.dt, { color: color.inkMuted }]}>{C.after}</Text>
            {p.after.map((line) => (
              <Text key={`a-${line}`} style={[styles.dd, { color: color.ink }]}>{line}</Text>
            ))}
          </View>
        </View>
      ) : null}
      <Text style={[DT.caption, { color: color.inkMuted }]}>
        {C.who[p.who]}
        {p.money ? ` · ${MONEY.network}` : ""}
      </Text>
      {p.phase === "done" ? (
        <Text style={[DT.body, { color: color.ink }]} accessibilityLiveRegion="polite">
          {p.done ?? C.done}{" "}
          {p.signature ? (
            <Text style={{ color: color.accent }} accessibilityRole="link" onPress={() => void openExternal(txUrl(p.signature as Signature, "mainnet-beta"))}>
              {C.doneTx}
            </Text>
          ) : null}
        </Text>
      ) : p.phase === "failed" ? (
        <Text style={[DT.body, { color: color.warning }]} accessibilityRole="alert">{C.failed(p.problem ?? "")}</Text>
      ) : expired ? (
        <Text style={[DT.caption, { color: color.inkMuted }]}>{C.expired}</Text>
      ) : null}
      <View style={styles.actions}>
        {p.phase !== "done" && !expired ? (
          <DkControl tone="primary" label={p.phase === "signing" ? C.confirming : busy ? C.sending : (p.confirmLabel ?? C.confirm)} disabled={busy || p.disabled} onPress={p.onConfirm} />
        ) : null}
        <DkControl label={p.phase === "done" ? "Close" : C.notNow} onPress={p.onClose} disabled={busy} />
        {p.phase === "idle" && !expired ? <Text style={[DT.caption, { color: color.inkMuted }]}>{C.expires(stamp(p.expiresAtSec, p.zone))}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  clearClose: { paddingRight: 36 },
  diff: { flexDirection: "row", gap: 12 },
  diffCol: { flex: 1, minWidth: 0 },
  dt: { marginBottom: 4, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  dd: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
});
