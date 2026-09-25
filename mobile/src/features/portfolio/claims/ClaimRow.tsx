import { diagnosisCopy, formatCadence } from "@agari/core/copy";
import { OUTCOME_TO_SIDE, type ClaimLeg, type ClaimableRow } from "@agari/core/types";
import { formatBaseUnits, formatUtc, secToMs, shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { itemKey, legWords, progressCounts } from "@/features/markets/claims/claim-run";
import type { ClaimItem, ClaimRun } from "@/features/markets/claims/types";
import { useVoidWords } from "@/features/markets/claims/void-line";
import { CLAIM } from "@/lib/copy";
import { ErrorState } from "~/components/portfolio/web";
import { openExternal } from "~/lib/external";
import { marketsEnv } from "~/lib/env";
import { useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";

const money = (base: bigint, decimals: number, maxDp?: number) => formatBaseUnits(base, decimals, { maxDp });

/** web `Hash` with an explorer href: the short hash, underlined, opening the transaction. */
function TxHash({ hash }: { hash: string }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={() => void openExternal(txUrl(hash as Parameters<typeof txUrl>[0], marketsEnv.cluster))} accessibilityRole="link" hitSlop={6}>
      <Text style={[WEB_TYPE.caption, WEB_TYPE.numbers, styles.hash, { color: color.ink }]}>{shortHex(hash)}</Text>
    </Pressable>
  );
}

/** One leg: "UP 12.00 contracts → 11.88", then its status, tx and any failure (web `ClaimRow` LegLine). */
function LegLine({ row, leg, item }: { row: ClaimableRow; leg: ClaimLeg; item: ClaimItem | undefined }) {
  const { color } = useTheme();
  const status = item?.status ?? "pending";
  const failure = item?.diagnosis && status !== "confirmed" ? diagnosisCopy(item.diagnosis.kind).headline : null;
  return (
    <View style={styles.line}>
      <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>
        <Text style={{ color: color.ink }}>{CLAIM.leg[OUTCOME_TO_SIDE[leg.outcomeIdx]]}</Text> <Text style={WEB_TYPE.numbers}>{money(leg.amountRaw, row.decimals, 2)}</Text> {CLAIM.contracts} →{" "}
        <Text style={[WEB_TYPE.numbers, { color: color.ink }]}>{money(leg.payoutBase, row.decimals)}</Text>
      </Text>
      <View style={styles.lineEnd}>
        <Text style={[WEB_TYPE.caption, { color: status === "confirmed" || status === "paid" ? color.ink : color.inkSecondary }]}>{item ? CLAIM.status[status] : CLAIM.status.pending}</Text>
        {item?.txHash ? <TxHash hash={item.txHash} /> : null}
        {failure ? <Text style={[WEB_TYPE.caption, { color: color.warning }]}>{failure}</Text> : null}
      </View>
    </View>
  );
}

/** web `ClaimRow`: one settled Window on surface-1 — asset and cadence, kind and time, the net in type-data-lg, the legs. */
export function ClaimRow({ row, items }: { row: ClaimableRow; items: readonly ClaimItem[] | undefined }) {
  const { color } = useTheme();
  const voidWords = useVoidWords(row.marketId, row.kind === "void", undefined);
  const timeLabel = row.settledAtMs === null ? CLAIM.closed : CLAIM.settled;
  const timeMs = row.settledAtMs ?? secToMs(row.expirySec);
  const item = items?.find((i) => i.key === itemKey(row.marketId));
  return (
    <View style={[styles.row, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]}>
            {row.asset} · {formatCadence(row.intervalSec)}
          </Text>
          <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>
            {CLAIM.kind[row.kind]} · {timeLabel} <Text style={WEB_TYPE.numbers}>{formatUtc(timeMs, { withSeconds: false })}</Text>
          </Text>
          {voidWords ? <Text style={[WEB_TYPE.caption, { color: color.inkMuted }]}>{voidWords.reason}</Text> : null}
        </View>
        <Text style={[WEB_TYPE.dataLg, { color: color.ink }]}>{money(row.netPayoutBase, row.decimals)}</Text>
      </View>
      <View style={styles.legs}>
        {row.legs.map((leg) => (
          <LegLine key={leg.outcomeIdx} row={row} leg={leg} item={item} />
        ))}
      </View>
    </View>
  );
}

/** web `ClaimProgress`: "claiming 2 of 4", then each item's own outcome — never one collapsed verdict (AD-15). */
export function ClaimProgress({ run, onRetry }: { run: ClaimRun; onRetry?: () => void }) {
  const { color } = useTheme();
  const { total, confirmed, current } = progressCounts(run);
  const headline = run.status === "running" ? CLAIM.progress(current ?? 1, total) : CLAIM.finished(confirmed, total);
  const stoppedEarly = run.status === "done" && run.diagnosis !== null;
  return (
    <View style={[styles.progress, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
      <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]} accessibilityLiveRegion="polite">
        {headline}
      </Text>
      <View style={styles.legs}>
        {run.items.map((item) => {
          const failure = item.diagnosis && item.status !== "confirmed" ? diagnosisCopy(item.diagnosis.kind).headline : null;
          return (
            <View key={item.key} style={styles.line}>
              <Text style={[WEB_TYPE.caption, { color: color.ink }]}>
                {item.asset} · {formatCadence(item.intervalSec)} · {legWords(item)} <Text style={WEB_TYPE.numbers}>{money(item.payoutBase, item.decimals)}</Text>
              </Text>
              <View style={styles.lineEnd}>
                <Text style={[WEB_TYPE.caption, { color: item.status === "claiming" ? color.accent : item.status === "confirmed" || item.status === "paid" ? color.ink : color.inkSecondary }]}>
                  {CLAIM.status[item.status]}
                </Text>
                {item.txHash ? <TxHash hash={item.txHash} /> : null}
                {failure ? <Text style={[WEB_TYPE.caption, { color: color.warning }]}>{failure}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
      {stoppedEarly && run.diagnosis ? (
        <View style={styles.stopped}>
          <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.stopped}</Text>
          <ErrorState diagnosis={run.diagnosis} retry={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, borderRadius: 8, borderWidth: 1, padding: 12 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  headText: { flexShrink: 1, minWidth: 0, gap: 2 },
  legs: { gap: 4 },
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, rowGap: 4 },
  lineEnd: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  hash: { textDecorationLine: "underline" },
  progress: { gap: 12, borderRadius: 8, borderWidth: 1, padding: 12 },
  stopped: { gap: 8 },
});
