import { formatCadence } from "@agari/core/copy";
import type { PrivateTicket } from "@agari/core/private";
import type { Address } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import * as Clipboard from "expo-clipboard";
import { Download, LoaderCircle, ShieldAlert, ShieldCheck, Upload } from "lucide-react-native";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { exportPrivateClaims, importPrivateClaims, loadPrivateTickets } from "@/features/private/claims-store";
import { PRIVATE } from "@/features/private/copy";
import { usePrivateCashout } from "@/features/private/usePrivateCashout";
import { verifyTicket } from "@/features/private/verify";
import { usePortfolioTokens } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";
import { usePlateInk } from "../usePlateInk";

/** web claims-store's cadence: the stored claims are re-read every few seconds (the phone has no storage event). */
const REFRESH_MS = 4_000;

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

const closeLabel = (expirySec: number) => `${new Date(expirySec * 1000).toISOString().slice(11, 16)} UTC`;

function sinceLabel(ts: number, nowMs: number): string {
  const mins = Math.max(0, Math.round((nowMs - ts) / 60_000));
  if (mins < 1) return PRIVATE.claims.just;
  if (mins < 60) return PRIVATE.claims.minutes(mins);
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return PRIVATE.claims.hours(hrs);
  return PRIVATE.claims.days(Math.round(hrs / 24));
}

interface Props {
  owner: string;
  pinnedDesk: Address | null;
  contract: Address | null;
  chainId: number;
  decimals: number;
  symbol: string;
}

/**
 * web `PrivateClaims` in the plate (private-claims.css `.plate-rows .pc*`): the private positions this phone holds the
 * proof for, each verified locally against the key the chain pins; Back up shares the claims file (the phone's share
 * sheet for web's download), Restore reads a backup from the clipboard (for web's file picker).
 */
export function PrivateClaims({ owner, pinnedDesk, contract, chainId, decimals, symbol }: Props) {
  const { color } = useTheme();
  const ink = usePlateInk();
  const t = usePortfolioTokens();
  const { tickets, refresh } = useTickets(owner);
  const cashout = usePrivateCashout(refresh, decimals, symbol);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [restored, setRestored] = useState<string | null>(null);
  const nowMs = Date.now();

  useEffect(() => {
    let cancelled = false;
    if (pinnedDesk === null) return setVerified({});
    void (async () => {
      const next: Record<string, boolean> = {};
      for (const c of tickets) next[c.claim.slotId] = await verifyTicket(c, pinnedDesk, contract, chainId);
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
      setRestored(added > 0 ? PRIVATE.claims.restored(added, skipped) : skipped > 0 ? PRIVATE.claims.skipped(skipped) : PRIVATE.claims.nothingNew);
      refresh();
    } catch {
      setRestored(PRIVATE.claims.unreadable);
    }
  };
  const pcBtn = (label: string, icon: ReactNode, onPress: () => void, disabled = false) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[styles.btn, { borderColor: t.vInk22 }, disabled && styles.faint]}>
      {icon}
      <Text style={[styles.btnText, { color: ink.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.pc, { borderColor: ink.line, backgroundColor: ink.raised }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: ink.ink }]}>{PRIVATE.claims.title}</Text>
          <Text style={[styles.sub, { color: ink.mute }]}>{PRIVATE.claims.sub}</Text>
        </View>
        <View style={styles.actions}>
          {pcBtn(PRIVATE.claims.backUp, <Download size={14} color={ink.ink} />, backUp, tickets.length === 0)}
          {pcBtn(PRIVATE.claims.restore, <Upload size={14} color={ink.ink} />, () => void restore())}
        </View>
      </View>
      {restored ? <Text style={[styles.note, { color: t.ink78 }]}>{restored}</Text> : null}
      {tickets.some((c) => verified[c.claim.slotId] === false) ? (
        <Text style={[styles.warn, { color: color.loss, borderColor: t.loss30, backgroundColor: color.lossWash }]}>{PRIVATE.claims.warn}</Text>
      ) : null}
      {tickets.length === 0 ? (
        <View style={[styles.pc, styles.empty, { borderColor: ink.line, backgroundColor: ink.raised }]}>
          <Text style={[styles.title, { color: ink.ink }]}>{PRIVATE.claims.emptyTitle}</Text>
          <Text style={[styles.sub, { color: ink.mute }]}>{PRIVATE.claims.emptySub}</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {tickets.map((c) => {
          const ok = verified[c.claim.slotId];
          const busy = cashout.busySlot === c.claim.slotId;
          const stake = BigInt(c.claim.stakeBase);
          const payout = c.payoutBase !== undefined ? BigInt(c.payoutBase) : null;
          const up = c.claim.outcomeIdx === 0;
          const won = payout !== null && payout >= stake;
          return (
            <View key={c.claim.slotId} style={[styles.row, { borderColor: ink.line }]}>
              <View style={styles.rowMain}>
                <Text style={[styles.side, { color: up ? t.pcUp : t.pcDown, backgroundColor: up ? t.pcUpWash : t.pcDownWash }]}>{up ? "UP" : "DOWN"}</Text>
                <Text style={[styles.strike, { color: ink.ink }]}>
                  {c.asset} {formatCadence(c.intervalSec)} · {closeLabel(c.expirySec)}
                </Text>
                <Text style={[styles.stake, { color: ink.mute }]}>
                  {formatBaseUnits(stake, decimals)} {symbol}
                </Text>
                {payout !== null && c.status !== "open" ? (
                  <Text style={[styles.payout, { color: won ? t.pcUp : t.pcDown }]}>
                    {won ? "+" : "−"}
                    {formatBaseUnits(won ? payout - stake : stake - payout, decimals)}
                  </Text>
                ) : null}
                {payout === null && c.status === "credited" && c.creditedBase !== undefined ? (
                  <Text style={[styles.stake, { color: ink.mute }]}>{PRIVATE.claims.home(formatBaseUnits(BigInt(c.creditedBase), decimals), symbol)}</Text>
                ) : null}
                <Text style={[styles.when, { color: t.ink50 }]}>{sinceLabel(c.openedAtMs, nowMs)}</Text>
              </View>
              <View style={styles.rowSide}>
                {ok === undefined ? (
                  <Text style={[styles.check, { color: t.ink40 }]}>{PRIVATE.claims.checking}</Text>
                ) : (
                  <View style={styles.checkRow}>
                    {ok ? <ShieldCheck size={14} color={t.pcUp} /> : <ShieldAlert size={14} color={t.pcDown} />}
                    <Text style={[styles.check, { color: ok ? t.pcUp : t.pcDown }]}>{ok ? PRIVATE.claims.verified : PRIVATE.claims.unverified}</Text>
                  </View>
                )}
                {c.status === "open" ? (
                  <Pressable
                    onPress={() => void cashout.cashOut(c)}
                    disabled={busy || ok === false}
                    accessibilityRole="button"
                    style={[styles.cash, { backgroundColor: ink.ink }, (busy || ok === false) && styles.half]}
                  >
                    {busy ? <LoaderCircle size={14} color={ink.paper} /> : null}
                    <Text style={[styles.cashText, { color: ink.paper }]}>{busy ? PRIVATE.claims.cashingOut : PRIVATE.claims.cashOut}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.status, { color: t.ink50 }]}>{c.status === "credited" ? PRIVATE.claims.credited : PRIVATE.claims.settled}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={[styles.foot, { color: ink.mute }]}>{PRIVATE.claims.foot}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pc: { borderWidth: 1, borderRadius: 16, padding: 16 },
  empty: { marginTop: 14 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  headText: { flexShrink: 1 },
  title: { fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 22.4 },
  sub: { marginTop: 2, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  btnText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  faint: { opacity: 0.4 },
  note: { marginTop: 10, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  warn: { marginTop: 10, fontFamily: FONT.body, fontSize: 12, lineHeight: 18, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, overflow: "hidden" },
  list: { marginTop: 14, gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  rowMain: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, minWidth: 0, flexShrink: 1 },
  rowSide: { flexDirection: "row", alignItems: "center", gap: 10 },
  side: { fontFamily: FONT.bodyStrong, fontSize: 11, letterSpacing: 0.66, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: "hidden" },
  strike: { fontFamily: FONT.bodyStrong, fontSize: 13, fontVariant: ["tabular-nums"] },
  stake: { fontFamily: FONT.body, fontSize: 12, fontVariant: ["tabular-nums"] },
  payout: { fontFamily: FONT.bodyStrong, fontSize: 12, fontVariant: ["tabular-nums"] },
  when: { fontFamily: FONT.body, fontSize: 11 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  check: { fontFamily: FONT.bodyStrong, fontSize: 11 },
  cash: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  cashText: { fontFamily: FONT.bodyStrong, fontSize: 12 },
  half: { opacity: 0.5 },
  status: { fontFamily: FONT.body, fontSize: 11, textTransform: "capitalize" },
  foot: { marginTop: 14, fontFamily: FONT.body, fontSize: 11, lineHeight: 16.5 },
});
