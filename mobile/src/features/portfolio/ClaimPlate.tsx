import { netClaimableSum } from "@agari/core/claims";
import { blockerLabel, diagnosisCopy, formatCadence } from "@agari/core/copy";
import { OUTCOME_TO_SIDE, type ClaimableRow } from "@agari/core/types";
import { formatUtc, secToMs, shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { keys, useClaimables } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { deriveClaimBlocker } from "@/features/markets/claims/claim-blocker";
import { confirmedItems, itemKey, legWords, paidTotal, progressCounts } from "@/features/markets/claims/claim-run";
import type { ClaimItem, ClaimRun } from "@/features/markets/claims/types";
import { useClaimAll } from "@/features/markets/claims/useClaimAll";
import { useVenue } from "@/features/markets/useVenue";
import { CLAIM } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, EmptyState, ReadingView, type QuoteLine } from "~/components/kit";
import { openExternal } from "~/lib/external";
import { marketsEnv } from "~/lib/env";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { money } from "./format";
import { SignSheet } from "./SignSheet";
import { afterCommit, useSignFlow } from "./useSignFlow";
import { VaultCredits } from "./VaultCredits";

function highestFeeBps(rows: readonly ClaimableRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.feeBps), 0);
}

/** One item's live line in a run: what it pays, its status word, its tx (web `ClaimProgress` ItemLine). */
function ItemLine({ item }: { item: ClaimItem }) {
  const { color } = useTheme();
  const failure = item.diagnosis && item.status !== "confirmed" ? diagnosisCopy(item.diagnosis.kind).headline : null;
  return (
    <View style={styles.item}>
      <Text style={[TYPE.caption, { color: color.ink }]}>
        {item.asset} · {formatCadence(item.intervalSec)} · {legWords(item)} · {money(item.payoutBase, item.decimals)}
      </Text>
      <Text style={[TYPE.caption, { color: item.status === "claiming" ? color.accent : color.inkSecondary }]}>
        {CLAIM.status[item.status]}
        {failure ? ` · ${failure}` : ""}
      </Text>
      {item.txHash ? <Button label={`${shortHex(item.txHash)} ↗`} variant="ghost" size="sm" block={false} onPress={() => void openExternal(txUrl(item.txHash as NonNullable<ClaimItem["txHash"]>, marketsEnv.cluster))} /> : null}
    </View>
  );
}

/** web `ClaimProgress`: "claiming 2 of 4", then every item's own outcome — never one collapsed verdict (AD-15). */
function Progress({ run }: { run: ClaimRun }) {
  const { color } = useTheme();
  const { total, confirmed, current } = progressCounts(run);
  const head = run.status === "running" ? CLAIM.progress(current ?? 1, total) : CLAIM.finished(confirmed, total);
  return (
    <View style={[styles.box, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLiveRegion="polite">
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{head}</Text>
      {run.items.map((item) => (
        <ItemLine key={item.key} item={item} />
      ))}
      {run.status === "done" && run.diagnosis ? <Text style={[TYPE.caption, { color: color.warning }]}>{CLAIM.stopped} {diagnosisCopy(run.diagnosis.kind).headline}</Text> : null}
    </View>
  );
}

/** One settled Window: its kind, when it settled, every leg → payout, the net figure (web `ClaimRow`). */
function Row({ row, item }: { row: ClaimableRow; item: ClaimItem | undefined }) {
  const { color } = useTheme();
  const timeMs = row.settledAtMs ?? secToMs(row.expirySec);
  return (
    <View style={[styles.box, { backgroundColor: color.surface2, borderColor: color.hairline }]}>
      <View style={styles.rowHead}>
        <View style={styles.flex}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{row.asset} · {formatCadence(row.intervalSec)}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {CLAIM.kind[row.kind]} · {row.settledAtMs === null ? CLAIM.closed : CLAIM.settled} {formatUtc(timeMs, { withSeconds: false })}
          </Text>
        </View>
        <Text style={[TYPE.dataLg, { color: color.ink }]}>{money(row.netPayoutBase, row.decimals)}</Text>
      </View>
      {row.legs.map((leg) => (
        <Text key={leg.outcomeIdx} style={[TYPE.caption, { color: color.inkSecondary }]}>
          <Text style={{ color: color.ink }}>{CLAIM.leg[OUTCOME_TO_SIDE[leg.outcomeIdx]]}</Text> {money(leg.amountRaw, row.decimals)} {CLAIM.contracts} → {money(leg.payoutBase, row.decimals)} · {item ? CLAIM.status[item.status] : CLAIM.status.pending}
        </Text>
      ))}
    </View>
  );
}

/**
 * web `LiveClaimPlate` ("03 · To collect"): the wallet's claimables, one net figure, a row per settled Window, and
 * Claim all — one wallet signature per Window through web's `useClaimAll`, with per-item progress and the receipt of
 * what landed. Trading Balance credits are listed beside the plate, never inside its sum (AD-1).
 */
export function ClaimPlate() {
  const { color } = useTheme();
  const session = useWalletSession();
  const venue = useVenue();
  const queryClient = useQueryClient();
  const reading = useClaimables(session.address, venue.venueId);
  const { run, claimAll, reset, hasSigner } = useClaimAll();
  const flow = useSignFlow();
  const latestRun = useRef(run);
  latestRun.current = run;
  if (!session.address) return <EmptyState why={CLAIM.disconnected.why} />;
  const blocker = deriveClaimBlocker({ session, hasSigner, run });
  const retry = () => void queryClient.invalidateQueries({ queryKey: keys.claimables(session.address, venue.venueId) });

  return (
    <View style={styles.gap}>
      <ReadingView reading={reading} loading="plate" retry={retry}>
        {(rows) => {
          if (rows.length === 0 && run.status === "idle") return <EmptyState why={CLAIM.empty.why} />;
          const decimals = rows[0]?.decimals ?? venue.decimals ?? run.items[0]?.decimals ?? 6;
          const sum = netClaimableSum(rows);
          const items = run.status === "idle" ? undefined : run.items;
          const lines: QuoteLine[] = rows.map((row) => ({ label: `${row.asset} · ${formatCadence(row.intervalSec)} · ${CLAIM.kind[row.kind].split(" — ")[0]}`, value: money(row.netPayoutBase, row.decimals) }));
          lines.push({ label: `Paid to your wallet · ${CLAIM.feeNote(highestFeeBps(rows))}`, value: money(sum, decimals), tone: "accent" });
          const confirm = () =>
            void flow.run(async () => {
              await claimAll(rows);
              await afterCommit();
              const done = latestRun.current;
              const { total, confirmed } = progressCounts(done);
              return { landed: total > 0 && confirmed === total, tone: confirmed === total ? "ok" : "warn", text: CLAIM.finished(confirmed, total) };
            });
          return (
            <View style={[styles.plate, { backgroundColor: color.accentWash, borderColor: color.accentDim }]}>
              <Text style={[TYPE.title, { color: color.ink }]}>{CLAIM.title}</Text>
              <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.waiting(rows.length)}</Text>
              {rows.length > 0 ? (
                <View>
                  <Text style={[TYPE.dataLg, { color: color.ink }]}>{money(sum, decimals)}</Text>
                  <Text style={[TYPE.labelMicro, { color: color.inkSecondary }]}>
                    {CLAIM.netLabel} · {CLAIM.feeNote(highestFeeBps(rows))}
                  </Text>
                </View>
              ) : null}
              {rows.map((row) => (
                <Row key={row.marketId} row={row} item={items?.find((i) => i.key === itemKey(row.marketId))} />
              ))}
              {run.status !== "idle" ? <Progress run={run} /> : null}
              {run.status === "done" && confirmedItems(run.items).length > 0 ? (
                <View style={[styles.paper, { backgroundColor: color.cream }]}>
                  <Text style={[TYPE.labelMicro, { color: color.creamInk, opacity: 0.6 }]}>{CLAIM.receipt.title}</Text>
                  <Text style={[TYPE.dataHero, { color: color.creamInk }]}>{money(paidTotal(run.items), decimals)}</Text>
                  <Text style={[TYPE.caption, { color: color.creamInk }]}>{CLAIM.receipt.figureLabel}</Text>
                  <Button label="Clear" variant="ghost" size="sm" block={false} onPress={reset} />
                </View>
              ) : null}
              {rows.length > 0 ? (
                <>
                  <Button label={blocker ? blockerLabel(blocker) : run.status === "done" ? CLAIM.retry : CLAIM.claimAll} size="lg" disabled={blocker !== null} onPress={flow.start} />
                  <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.oneSignatureEach}</Text>
                </>
              ) : null}
              <SignSheet
                visible={flow.open}
                onClose={flow.close}
                title={`${CLAIM.claimAll} · ${CLAIM.waiting(rows.length)}`}
                lines={lines}
                maxLoss={null}
                confirmLabel="Slide to claim"
                onConfirm={confirm}
                phase={run.status === "running" ? "sending" : flow.phase}
                outcome={flow.outcome}
              >
                {run.status !== "idle" ? <Progress run={run} /> : null}
              </SignSheet>
            </View>
          );
        }}
      </ReadingView>
      <VaultCredits />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 16 },
  plate: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  box: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  flex: { flex: 1 },
  item: { gap: 2 },
  paper: { borderRadius: RADIUS.md, padding: 14, gap: 4 },
});
