import { nameOf } from "@agari/core/desk";
import { Clock3, Hand, OctagonAlert } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { DESK } from "@/features/desk/copy";
import { ago, pct, span, stamp } from "@/features/desk/format";
import type { ApprovalWire } from "@/features/desk/protocol";
import type { DeskActions } from "@/features/desk/useDeskWrites";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { CpAction, DT, LinearWash, Panel, RadialGauge, useDeskTheme } from "../kit";

const N = DESK.page.needsYou;

/**
 * One approval as a trade ticket (web's DeskPanels `ApprovalCard`): the company's mark, the trade, why it asks, how
 * sure the model is, then Approve / Decline. The button asks the wallet straight away, as web's does; the wallet's
 * own prompt is the confirmation.
 */
function ApprovalCard({ a, view, actions, zone, nowSec }: { a: ApprovalWire; view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number }) {
  const { color } = useDeskTheme();
  const expired = a.status !== "open" || a.expiresAtSec <= nowSec;
  const busy = actions?.state.busy === "approval";
  return (
    <View style={[styles.approval, { borderColor: color.hairline }, expired && styles.expired]}>
      <LinearWash from={color.surface2} radius={13} />
      <View style={styles.head}>
        {a.symbol ? (
          <AssetDisc asset={a.symbol} size={44} />
        ) : (
          <View style={[styles.iconDisc, { backgroundColor: color.surface2 }]}>
            <Hand size={20} color={color.warning} />
          </View>
        )}
        <View style={styles.headText}>
          <Text style={[styles.title, { color: color.ink }]}>{a.summary}</Text>
          {a.symbol && a.amountIn && a.expectedOut ? <Text style={[DT.mono, { color: color.inkSecondary }]}>{N.trade(a.side ?? "buy", a.amountIn, a.expectedOut, nameOf(a.symbol))}</Text> : null}
        </View>
        {a.confidencePercent !== null ? (
          <RadialGauge value={a.confidencePercent} size={52} stroke={5} tone="accent" label={N.confidence(a.confidencePercent)}>
            {`${a.confidencePercent}%`}
          </RadialGauge>
        ) : null}
      </View>
      <Text style={[DT.caption, { color: color.inkMuted }]}>
        {N.asking[a.reason]}
        {a.confidencePercent !== null ? ` · ${N.confidence(a.confidencePercent)}` : ""}
        {a.costBps !== null ? ` · ${N.cost(pct(a.costBps))}` : ""}
      </Text>
      {a.turnedDown ? <Text style={[DT.caption, { color: color.inkSecondary }]}>{N.turnedDown(a.turnedDown)}</Text> : null}
      {expired ? (
        <View style={styles.expiredLine}>
          <Clock3 size={14} color={color.inkMuted} />
          <Text style={[DT.caption, { color: color.inkMuted }]}>{N.expired}</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          {view.isOwner && actions ? (
            <>
              <CpAction label={busy ? N.approving : N.approve} tone="primary" disabled={busy} onPress={() => void actions.answer(a, "approve")} />
              <CpAction label={N.decline} disabled={busy} onPress={() => void actions.answer(a, "decline")} />
            </>
          ) : null}
          <View style={styles.expiresLine}>
            <Clock3 size={13} color={color.inkMuted} />
            <Text style={[DT.caption, styles.grow, { color: color.inkMuted }]}>{N.expires(`${stamp(a.expiresAtSec, zone)} · ${span(a.expiresAtSec - nowSec)}`)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

/** web's `NeedsYou`: approvals waiting and the state warnings; when all is quiet, one calm line. */
export function NeedsYou({ view, actions, zone, nowSec }: { view: DeskView; actions: DeskActions | null; zone: string | null; nowSec: number }) {
  const { color, t } = useDeskTheme();
  const warnings: string[] = [];
  if (view.state === "paused_by_owner") warnings.push(N.paused);
  if (view.state === "stopped_by_loss_limit") warnings.push(N.lossStop);
  if (view.state === "closed") warnings.push(N.closed);
  if (view.nextCheck.late && view.nextCheck.lastAtSec !== null) warnings.push(N.late(ago(view.nextCheck.lastAtSec, nowSec)));
  if (view.wire.desk?.stateReason && view.state === "needs_attention") warnings.push(view.wire.desk.stateReason);
  const approvals = [...view.approvals.open, ...view.approvals.expired];
  if (warnings.length === 0 && approvals.length === 0) {
    return (
      <View style={[styles.quiet, { borderColor: color.hairline }]}>
        <View style={[styles.quietDot, { backgroundColor: color.profit, boxShadow: `0 0 0 4px ${color.profitWash}` }]} />
        <Text style={[DT.panelTitle, { color: color.inkMuted }]}>{N.title}</Text>
        <Text style={[DT.caption, { color: color.inkSecondary }]}>{N.nothing}</Text>
      </View>
    );
  }
  const open = view.approvals.open.length;
  return (
    <Panel
      title={N.title}
      borderColor={t.needsBorder}
      aside={
        open > 0 ? (
          <View style={[styles.count, { backgroundColor: color.warning }]}>
            <Text style={[styles.countText, { color: color.creamInk }]}>{open}</Text>
          </View>
        ) : undefined
      }
    >
      {warnings.map((w) => (
        <View key={w} style={styles.warning}>
          <OctagonAlert size={17} color={color.warning} style={styles.warnIcon} />
          <Text style={[styles.warningText, { color: color.warning }]}>{w}</Text>
        </View>
      ))}
      {approvals.map((a) => (
        <ApprovalCard key={a.id} a={a} view={view} actions={actions} zone={zone} nowSec={nowSec} />
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  approval: { gap: 10, padding: 16, borderWidth: 1, borderRadius: 14 },
  expired: { opacity: 0.6 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconDisc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: FONT.heading, fontSize: 16, lineHeight: 25.6 },
  expiresLine: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  grow: { flexShrink: 1 },
  expiredLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  quiet: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderRadius: 12 },
  quietDot: { width: 8, height: 8, borderRadius: 4 },
  count: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  countText: { fontFamily: FONT.bodyStrong, fontSize: 12 },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  warnIcon: { marginTop: 2 },
  warningText: { flex: 1, fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
});
