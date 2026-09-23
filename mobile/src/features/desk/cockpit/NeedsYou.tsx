import { nameOf } from "@agari/core/desk";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { ago, pct, span, stamp, tokensText, usdText } from "@/features/desk/format";
import type { ApprovalWire } from "@/features/desk/protocol";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import type { NativeDeskView as DeskView } from "../native-view";
import { Button, type QuoteLine } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { said } from "../controls/review-lines";
import { ReviewSheet } from "../controls/ReviewSheet";
import { Panel, RadialGauge } from "../kit";

const N = DESK.page.needsYou;

/** The most an approval can cost: nothing in practice; on a live desk, what it spends (a buy) or sells (a sell). */
function approvalLoss(a: ApprovalWire, live: boolean): string {
  if (!live) return "$0.00";
  if (a.side === "sell" && a.amountIn && a.symbol) return `${tokensText(a.amountIn)} ${a.symbol}`;
  return a.amountIn ? `${usdText(a.amountIn)} USDC` : "—";
}

/** One approval as a trade ticket (web's DeskPanels `ApprovalCard`); Approve and Decline each open a review. */
function ApprovalCard({ a, view, actions, zone, nowSec }: { a: ApprovalWire; view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number }) {
  const { color } = useTheme();
  const [answer, setAnswer] = useState<"approve" | "decline" | null>(null);
  const expired = a.status !== "open" || a.expiresAtSec <= nowSec;
  const trade = a.symbol && a.amountIn && a.expectedOut ? N.trade(a.side ?? "buy", a.amountIn, a.expectedOut, nameOf(a.symbol)) : null;
  const lines: QuoteLine[] = [
    ...(trade ? [said(a.side === "sell" ? "Sell" : "Buy", a.symbol ? nameOf(a.symbol) : "—", trade)] : []),
    said("Why it asks", a.reason === "ask_first" ? "Ask first" : "Large", N.asking[a.reason]),
    ...(a.confidencePercent !== null ? [{ label: "Timing", value: `${a.confidencePercent}% sure` }] : []),
    ...(a.costBps !== null ? [said("Cost", pct(a.costBps), N.cost(pct(a.costBps)))] : []),
    said("Expires", span(a.expiresAtSec - nowSec), stamp(a.expiresAtSec, zone)),
  ];
  const close = () => {
    actions?.reset();
    setAnswer(null);
  };
  return (
    <View style={[styles.approval, { borderColor: color.hairline, opacity: expired ? 0.6 : 1 }]}>
      <View style={styles.head}>
        {a.symbol ? <AssetDisc asset={a.symbol} size={36} /> : <SymbolView name={{ ios: "hand.raised", android: "front_hand" }} size={24} tintColor={color.warning} />}
        <View style={styles.headText}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{a.summary}</Text>
          {trade ? <Text style={[TYPE.data, { color: color.inkSecondary }]}>{trade}</Text> : null}
        </View>
        {a.confidencePercent !== null ? (
          <RadialGauge value={a.confidencePercent} size={48} stroke={5} tone="accent" label={N.confidence(a.confidencePercent)}>
            <Text style={[TYPE.data, { color: color.ink, fontSize: 11 }]}>{a.confidencePercent}%</Text>
          </RadialGauge>
        ) : null}
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {N.asking[a.reason]}
        {a.costBps !== null ? ` · ${N.cost(pct(a.costBps))}` : ""}
      </Text>
      {a.turnedDown ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{N.turnedDown(a.turnedDown)}</Text> : null}
      {expired ? (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{N.expired}</Text>
      ) : (
        <>
          {view.isOwner && actions ? (
            <View style={styles.actions}>
              <Button label={N.approve} size="sm" block={false} style={styles.grow} onPress={() => setAnswer("approve")} />
              <Button label={N.decline} size="sm" variant="outline" block={false} style={styles.grow} onPress={() => setAnswer("decline")} />
            </View>
          ) : null}
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{N.expires(`${stamp(a.expiresAtSec, zone)} · ${span(a.expiresAtSec - nowSec)}`)}</Text>
        </>
      )}
      {actions && answer ? (
        <ReviewSheet
          visible
          onClose={close}
          title={answer === "approve" ? N.approve : N.decline}
          body={a.summary}
          review={{
            title: answer === "approve" ? "Approve this action" : "Decline this action",
            lines,
            maxLoss: answer === "approve" ? approvalLoss(a, view.isLive) : "$0.00",
            confirmLabel: answer === "approve" ? "Slide to approve" : "Slide to decline",
            tone: answer === "approve" ? "accent" : "loss",
          }}
          onConfirm={() => void actions.answer(a, answer)}
          phase={actions.state.phase}
          problem={actions.state.problem}
        />
      ) : null}
    </View>
  );
}

/** web's `NeedsYou`: approvals waiting and the state warnings; when all is quiet, one calm line. */
export function NeedsYou({ view, actions, zone, nowSec }: { view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number }) {
  const { color } = useTheme();
  const warnings: string[] = [];
  if (view.state === "paused_by_owner") warnings.push(N.paused);
  if (view.state === "stopped_by_loss_limit") warnings.push(N.lossStop);
  if (view.state === "closed") warnings.push(N.closed);
  if (view.nextCheck.late && view.nextCheck.lastAtSec !== null) warnings.push(N.late(ago(view.nextCheck.lastAtSec, nowSec)));
  if (view.wire.desk?.stateReason && view.state === "needs_attention") warnings.push(view.wire.desk.stateReason);
  const approvals = [...view.approvals.open, ...view.approvals.expired];
  if (warnings.length === 0 && approvals.length === 0) {
    return (
      <View style={[styles.quiet, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <View style={[styles.quietDot, { backgroundColor: color.profit }]} />
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{N.title}</Text>
        <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]}>{N.nothing}</Text>
      </View>
    );
  }
  const open = view.approvals.open.length;
  return (
    <Panel title={N.title} aside={open > 0 ? <Text style={[TYPE.data, { color: color.accent }]}>{open}</Text> : undefined}>
      {warnings.map((w) => (
        <View key={w} style={styles.warning}>
          <SymbolView name={{ ios: "exclamationmark.octagon", android: "report" }} size={16} tintColor={color.warning} />
          <Text style={[TYPE.body, styles.grow, { color: color.ink }]}>{w}</Text>
        </View>
      ))}
      {approvals.map((a) => (
        <ApprovalCard key={a.id} a={a} view={view} actions={actions} zone={zone} nowSec={nowSec} />
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  approval: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  headText: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  quiet: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, paddingHorizontal: 14, minHeight: 48 },
  quietDot: { width: 8, height: 8, borderRadius: 4 },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});
