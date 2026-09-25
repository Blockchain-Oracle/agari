import { netClaimableSum } from "@agari/core/claims";
import { RECEIPT_FOOTER } from "@agari/core/copy";
import { formatCadence } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import type { ClaimableRow, MarketId } from "@agari/core/types";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { blockerLabel } from "@agari/core/copy";
import { keys, useClaimables, useResolution } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { deriveClaimBlocker } from "@/features/markets/claims/claim-blocker";
import { confirmedItems, legWords, paidTotal } from "@/features/markets/claims/claim-run";
import { useClaimAll } from "@/features/markets/claims/useClaimAll";
import { useVenue } from "@/features/markets/useVenue";
import { CLAIM } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Receipt, ReceiptRow } from "~/features/proof/Receipt";
import { EmptyState, ReadingBoundary, WebButton } from "~/components/portfolio/web";
import { useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { ClaimProgress, ClaimRow } from "./ClaimRow";
import { VaultCreditRows } from "./VaultCreditRows";

const highestFeeBps = (rows: readonly ClaimableRow[]) => rows.reduce((max, row) => Math.max(max, row.feeBps), 0);

/** web `MarketProofRows`: the settlement tx and the signed source for one Window; a proof not yet linked degrades in place. */
function ProofRows({ marketId }: { marketId: MarketId }) {
  const reading = useResolution(marketId);
  if (reading === null) {
    return (
      <>
        <ReceiptRow label={CLAIM.receipt.settlement}>{CLAIM.receipt.pending}</ReceiptRow>
        <ReceiptRow label={CLAIM.receipt.oracle}>{CLAIM.receipt.pending}</ReceiptRow>
      </>
    );
  }
  const hash = isOk(reading) ? (reading.value?.settlementTxHash ?? null) : null;
  return (
    <>
      <ReceiptRow label={CLAIM.receipt.settlement} explorer={hash ? { kind: "tx", id: hash } : undefined}>
        {hash ? shortHex(hash) : CLAIM.receipt.settlementDegraded}
      </ReceiptRow>
      <ReceiptRow label={CLAIM.receipt.oracle}>{shortHex(marketId)}</ReceiptRow>
    </>
  );
}

/**
 * web `LiveClaimPlate` + `ClaimPlate`: the wallet's claimables on the accent wash — one net figure (ink, never
 * vermilion), a row per settled Window, per-item progress, the blocked-or-live Claim all, the cream receipt for what
 * landed; then the Trading Balance's credits beside it, never inside its sum (AD-1).
 */
export function LiveClaimPlate() {
  const { color } = useTheme();
  const session = useWalletSession();
  const venue = useVenue();
  const queryClient = useQueryClient();
  const reading = useClaimables(session.address, venue.venueId);
  const { run, claimAll, hasSigner } = useClaimAll();
  if (!session.address) return <EmptyState why={CLAIM.disconnected.why} />;
  const blocker = deriveClaimBlocker({ session, hasSigner, run });
  const isEmpty = (rows: ClaimableRow[]) => rows.length === 0 && run.status === "idle";
  const retry = () => void queryClient.invalidateQueries({ queryKey: keys.claimables(session.address, venue.venueId) });

  return (
    <View>
      <ReadingBoundary reading={reading} shape="plate" isEmpty={isEmpty} empty={{ why: CLAIM.empty.why }} retry={retry}>
        {(rows) => {
          const decimals = rows[0]?.decimals ?? venue.decimals ?? run.items[0]?.decimals ?? 0;
          const items = run.status === "idle" ? undefined : run.items;
          const confirmed = run.status === "done" ? confirmedItems(run.items) : [];
          return (
            <View style={styles.stack}>
              <View style={[styles.plate, { borderColor: color.accentDim, backgroundColor: color.accentWash }]}>
                <View style={styles.header}>
                  <Text style={[WEB_TYPE.title, { color: color.ink }]}>{CLAIM.title}</Text>
                  <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.waiting(rows.length)}</Text>
                </View>
                {rows.length > 0 ? (
                  <View style={styles.sum}>
                    <Text style={[WEB_TYPE.dataLg, { color: color.ink }]}>{formatBaseUnits(netClaimableSum(rows), decimals)}</Text>
                    <Text style={[WEB_TYPE.labelMicro, { color: color.inkSecondary }]}>
                      {CLAIM.netLabel} · {CLAIM.feeNote(highestFeeBps(rows))}
                    </Text>
                  </View>
                ) : null}
                {rows.length > 0 ? (
                  <View style={styles.rows}>
                    {rows.map((row) => (
                      <ClaimRow key={row.marketId} row={row} items={items} />
                    ))}
                  </View>
                ) : null}
                {run.status !== "idle" ? <ClaimProgress run={run} onRetry={rows.length > 0 ? () => void claimAll(rows) : undefined} /> : null}
                {rows.length > 0 ? (
                  <View style={styles.rows}>
                    {blocker ? (
                      <WebButton label={blockerLabel(blocker)} variant="blocked" size="lg" block />
                    ) : (
                      <WebButton label={run.status === "done" ? CLAIM.retry : CLAIM.claimAll} size="lg" block onPress={() => void claimAll(rows)} />
                    )}
                    <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.oneSignatureEach}</Text>
                  </View>
                ) : null}
              </View>
              {run.status === "done" && run.finishedAtMs !== null && confirmed.length > 0 ? (
                <Receipt title={CLAIM.receipt.title} figure={formatBaseUnits(paidTotal(confirmed), decimals)} figureLabel={CLAIM.receipt.figureLabel} settledAtMs={run.finishedAtMs} footer={RECEIPT_FOOTER}>
                  {confirmed.map((item) => (
                    <ReceiptRow key={item.key} label={`${item.asset} · ${formatCadence(item.intervalSec)} · ${legWords(item)}`} explorer={item.txHash ? { kind: "tx", id: item.txHash } : undefined}>
                      {formatBaseUnits(item.payoutBase, item.decimals)}
                    </ReceiptRow>
                  ))}
                  {[...new Set(confirmed.map((i) => i.marketId))].map((marketId) => (
                    <View key={marketId} style={[styles.proofs, { borderTopColor: color.creamHairline }]}>
                      <ProofRows marketId={marketId} />
                    </View>
                  ))}
                </Receipt>
              ) : null}
            </View>
          );
        }}
      </ReadingBoundary>
      <VaultCreditRows />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 24 },
  plate: { gap: 16, borderRadius: 12, borderWidth: 1, padding: 16 },
  header: { gap: 4 },
  sum: { gap: 2 },
  rows: { gap: 8 },
  proofs: { gap: 8, borderTopWidth: 1, borderStyle: "dotted", paddingTop: 8 },
});
