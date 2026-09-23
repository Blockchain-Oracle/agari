import { formatCadence } from "@agari/core/copy";
import type { PrivateTicket } from "@agari/core/private";
import type { Address } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { exportPrivateClaims, importPrivateClaims, loadPrivateTickets } from "@/features/private/claims-store";
import { PRIVATE } from "@/features/private/copy";
import { usePrivateCashout } from "@/features/private/usePrivateCashout";
import { verifyTicket } from "@/features/private/verify";
import { Button } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";
import { usePlateInk } from "./usePlateInk";

/** web claims-store's cadence: the stored claims are re-read every few seconds. */
const REFRESH_MS = 4_000;

interface Props {
  owner: string;
  pinnedDesk: Address | null;
  contract: Address | null;
  chainId: number;
  decimals: number;
  symbol: string;
}

/** The owner's stored claims (web `usePrivateTickets`), polled; the phone has no cross-tab storage event to wait for. */
function useTickets(owner: string): { tickets: PrivateTicket[]; refresh: () => void } {
  const [tickets, setTickets] = useState<PrivateTicket[]>(() => loadPrivateTickets(owner));
  const refresh = useCallback(() => setTickets(loadPrivateTickets(owner)), [owner]);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);
  return { tickets, refresh };
}

/** "16:00 UTC": two open bets on different Windows of one asset must not read as one row. */
const closeLabel = (expirySec: number) => `${new Date(expirySec * 1000).toISOString().slice(11, 16)} UTC`;

/**
 * web `PrivateClaims`: the private positions this phone holds the proof for, each verified locally against the key
 * the chain pins, with Cash out on an open one. Back up shares the claims file through the system share sheet;
 * Restore reads a backup from the clipboard.
 */
export function PrivateClaimsList({ owner, pinnedDesk, contract, chainId, decimals, symbol }: Props) {
  const { color } = useTheme();
  const ink = usePlateInk();
  const { tickets, refresh } = useTickets(owner);
  const cashout = usePrivateCashout(refresh, decimals, symbol);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (pinnedDesk === null) return;
    void (async () => {
      const next: Record<string, boolean> = {};
      for (const t of tickets) next[t.claim.slotId] = await verifyTicket(t, pinnedDesk, contract, chainId);
      if (!cancelled) setVerified(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [tickets, pinnedDesk, contract, chainId]);

  const backUp = () => void Share.share({ title: PRIVATE.claims.fileName(new Date().toISOString().slice(0, 10)), message: exportPrivateClaims(owner) });
  const restore = async () => {
    try {
      const { added, skipped } = importPrivateClaims(await Clipboard.getStringAsync());
      setNote(added > 0 ? PRIVATE.claims.restored(added, skipped) : skipped > 0 ? PRIVATE.claims.skipped(skipped) : PRIVATE.claims.nothingNew);
      refresh();
    } catch {
      setNote(PRIVATE.claims.unreadable);
    }
  };
  const askCashOut = (t: PrivateTicket) => {
    const stake = `${formatBaseUnits(BigInt(t.claim.stakeBase), decimals)} ${symbol}`;
    Alert.alert(PRIVATE.claims.cashOut, `${t.asset} ${formatCadence(t.intervalSec)} · ${stake} staked. The desk settles the slot and credits what it paid to your private balance.`, [
      { text: "Not now", style: "cancel" },
      { text: PRIVATE.claims.cashOut, onPress: () => void cashout.cashOut(t) },
    ]);
  };

  return (
    <View style={[styles.box, { borderTopColor: ink.line }]}>
      <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>{PRIVATE.claims.title}</Text>
      <Text style={[TYPE.caption, { color: ink.mute }]}>{PRIVATE.claims.sub}</Text>
      <View style={styles.actions}>
        <Button label={PRIVATE.claims.backUp} icon={{ ios: "square.and.arrow.up", android: "ios_share" }} variant="outline" size="sm" block={false} disabled={tickets.length === 0} onPress={backUp} />
        <Button label={`${PRIVATE.claims.restore} from clipboard`} icon={{ ios: "doc.on.clipboard", android: "content_paste" }} variant="outline" size="sm" block={false} onPress={() => void restore()} />
      </View>
      {note ? <Text style={[TYPE.caption, { color: ink.ink }]} accessibilityLiveRegion="polite">{note}</Text> : null}
      {tickets.some((t) => verified[t.claim.slotId] === false) ? <Text style={[TYPE.caption, { color: color.warning }]}>{PRIVATE.claims.warn}</Text> : null}
      {tickets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>{PRIVATE.claims.emptyTitle}</Text>
          <Text style={[TYPE.caption, { color: ink.mute }]}>{PRIVATE.claims.emptySub}</Text>
        </View>
      ) : null}
      {tickets.map((t) => {
        const ok = verified[t.claim.slotId];
        const stake = BigInt(t.claim.stakeBase);
        const payout = t.payoutBase !== undefined ? BigInt(t.payoutBase) : null;
        const up = t.claim.outcomeIdx === 0;
        const busy = cashout.busySlot === t.claim.slotId;
        return (
          <View key={t.claim.slotId} style={[styles.row, { borderBottomColor: ink.line }]}>
            <View style={styles.rowMain}>
              <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>
                <Text style={{ color: up ? color.profit : color.loss }}>{up ? "UP" : "DOWN"}</Text> {t.asset} {formatCadence(t.intervalSec)} · {closeLabel(t.expirySec)}
              </Text>
              <Text style={[styles.data, { color: ink.mute }]}>
                {formatBaseUnits(stake, decimals)} {symbol}
                {payout !== null && t.status !== "open" ? `  ${payout >= stake ? "+" : "−"}${formatBaseUnits(payout >= stake ? payout - stake : stake - payout, decimals)}` : ""}
                {payout === null && t.status === "credited" && t.creditedBase !== undefined ? `  ${PRIVATE.claims.home(formatBaseUnits(BigInt(t.creditedBase), decimals), symbol)}` : ""}
              </Text>
              <Text style={[TYPE.caption, { color: ok === false ? color.warning : ink.mute }]}>
                {ok === undefined ? PRIVATE.claims.checking : ok ? PRIVATE.claims.verified : PRIVATE.claims.unverified}
                {t.status !== "open" ? ` · ${t.status === "credited" ? PRIVATE.claims.credited : PRIVATE.claims.settled}` : ""}
              </Text>
            </View>
            {t.status === "open" ? (
              <Button label={busy ? PRIVATE.claims.cashingOut : PRIVATE.claims.cashOut} size="sm" block={false} loading={busy} disabled={busy || ok === false} onPress={() => askCashOut(t)} />
            ) : null}
          </View>
        );
      })}
      <Text style={[TYPE.caption, { color: ink.mute }]}>{PRIVATE.claims.foot}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  empty: { gap: 2, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  rowMain: { flex: 1, gap: 2 },
  data: { fontFamily: FONT.data, fontSize: 13, fontVariant: ["tabular-nums"] },
});
