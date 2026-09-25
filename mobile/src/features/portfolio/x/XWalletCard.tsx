import { formatBaseUnits, parseDecimalToBaseUnits, shortHex } from "@agari/core/units";
import * as Clipboard from "expo-clipboard";
import { ChevronDown, RefreshCw, Unlink } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { X_CARD, X_HANDLE, X_LINK_STATUS } from "@/features/x/copy";
import { useXGrant } from "@/features/x/useXGrant";
import { useXStatus } from "@/features/x/useXStatus";
import { useWalletSession } from "@/lib/wallet-session";
import { FONT } from "~/theme";
import { go } from "../go";
import { PlateTicks } from "../LedgerPlate";
import { useXInk, xs } from "./ink";
import { XFund, type FundSource } from "./XFund";
import { XGlyph } from "./XGlyph";
import { XPermission } from "./XPermission";

/** Signing in with X is an OAuth hand-off; the app's is the native Trade-from-X screen. */
const TRADE_FROM_X = "/trade-from-x";

/**
 * web `XWalletCard` (x-card.css): the X-Predict wallet over an EXECUTOR grant — who this balance bets for first, then
 * the balance and Cash out, the permission, and Fund. `compact` sits inside the plate's X row with the heading and the
 * balance dropped (the row already says both); standalone it is the heading over its own `.ledger-plate`.
 */
export function XWalletCard({ compact = false, symbol = "tUSDC" }: { compact?: boolean; symbol?: string }) {
  const x = useXInk(!compact);
  const { address } = useWalletSession();
  const link = useXStatus();
  const grant = useXGrant();
  const [amount, setAmount] = useState("5");
  const [manage, setManage] = useState(false);
  const [source, setSource] = useState<FundSource>("wallet");

  const status = link.status;
  const session = status?.session ?? null;
  const binding = status?.binding ?? null;
  const connected = Boolean(session || binding);
  const boundWallet = binding?.wallet ?? null;
  const executor = status?.executor ?? null;
  const balance = grant.balanceBase;
  const shownBalance = balance === null ? "—" : formatBaseUnits(balance, grant.decimals);
  const permission = grant.permission(executor);
  const canFund = ["ready", "unfunded"].includes(permission) && !grant.pendingUpdate;
  const busy = grant.busy || link.busy;
  const err = grant.error || link.error;
  const ok = grant.ok || link.ok;

  const fund = () => {
    if (link.walletMismatch) return grant.clear(), link.setError(X_CARD.wrongWalletFund);
    const base = parseDecimalToBaseUnits(amount || "0", grant.decimals);
    if (!base || base <= 0n) return link.setError(X_CARD.enterAmount);
    void grant.fund(base, executor, source);
  };

  const vButton = (label: string, onPress: () => void, disabled = false) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={[xs.btnV, { borderColor: x.vBorder }, disabled && xs.disabled]}>
      <XGlyph color={x.v} />
      <Text style={[xs.btnVText, { color: x.v }]}>{label}</Text>
    </Pressable>
  );

  let slab = null;
  if (!link.loading) {
    if (link.walletMismatch && boundWallet) {
      slab = (
        <View style={[xs.slab, { borderColor: x.slabHard, backgroundColor: x.slabHardFill }]}>
          <Text style={[xs.slabTitle, { color: x.ink }]}>{X_CARD.wrongWallet(binding?.handle ?? "this X account")}</Text>
          <Text style={[xs.slabBody, { color: x.mute }]}>
            {X_CARD.itBetsFrom} <Text style={[xs.mono, { color: x.ink }]}>{shortHex(boundWallet)}</Text>
            {X_CARD.connectedAs} <Text style={[xs.mono, { color: x.ink }]}>{shortHex(address ?? "")}</Text>
            {X_CARD.strandedNote}
          </Text>
          <Pressable
            onPress={() => void Clipboard.setStringAsync(boundWallet).then(() => link.setOk(X_CARD.copied))}
            accessibilityRole="button"
            style={[xs.btnInk, styles.mt10, { borderColor: x.line }]}
          >
            <Text style={[xs.btnInkText, { color: x.ink }]}>{X_CARD.copyAddress(shortHex(boundWallet))}</Text>
          </Pressable>
          <Text style={[xs.slabNote, { color: x.mute }]}>{X_CARD.notInBrowser}</Text>
        </View>
      );
    } else if (link.needsLink && session) {
      const who = session.handle ?? session.authorId;
      slab = (
        <View style={[xs.slab, { borderColor: x.slab, backgroundColor: x.slabFill }]}>
          <Text style={[xs.slabTitle, { color: x.ink }]}>{binding ? X_CARD.switchQuestion(binding.handle ?? binding.authorId, who) : X_CARD.oneMoreStep(who)}</Text>
          {binding ? <Text style={[xs.slabBody, { color: x.mute }]}>{X_CARD.switchNote}</Text> : null}
          {vButton(link.busy === "link" ? X_CARD.linking : binding ? X_CARD.useHandle(who) : X_CARD.linkHandle(who), () => void link.link(), busy !== "")}
        </View>
      );
    } else if (connected) {
      slab = (
        <View style={styles.conn}>
          <Pressable onPress={() => setManage((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: manage }} style={[styles.connRow, { borderColor: x.line, backgroundColor: x.wash }]}>
            <XGlyph size={14} color={x.v} />
            <Text style={[styles.handle, { color: x.ink }]}>{binding?.handle ? `@${binding.handle}` : X_CARD.xConnected}</Text>
            <ChevronDown size={14} color={x.mute} style={[styles.chev, manage && styles.chevOpen]} />
          </Pressable>
          {manage ? (
            <View style={[styles.manage, { borderColor: x.line, backgroundColor: x.paper }]}>
              <Pressable onPress={() => go(TRADE_FROM_X)} accessibilityRole="link" style={[xs.btnInk, styles.stretch, { borderColor: x.line }]}>
                <RefreshCw size={14} color={x.ink} />
                <Text style={[xs.btnInkText, { color: x.ink }]}>{X_CARD.switchAccount}</Text>
              </Pressable>
              {link.sessionMatchesBinding ? (
                <Pressable onPress={() => void link.unlink()} disabled={busy !== ""} accessibilityRole="button" style={[styles.loss, busy !== "" && styles.half]}>
                  <Unlink size={14} color={x.loss} />
                  <Text style={[xs.btnInkText, { color: x.loss }]}>{link.busy === "unlink" ? X_CARD.disconnecting : X_CARD.disconnect}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => go(TRADE_FROM_X)} accessibilityRole="link" style={styles.loss}>
                  <Text style={[xs.btnInkText, { color: x.mute }]}>{X_CARD.verifyToDisconnect}</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      );
    } else {
      const quiet = balance !== null && balance > 0n;
      slab = (
        <View style={[xs.slab, { borderColor: x.slab, backgroundColor: x.slabFill }, quiet && xs.slabQuiet]}>
          <Text style={[xs.slabTitle, { color: x.ink }]}>{quiet ? X_CARD.linkToBet : X_CARD.connectFirst}</Text>
          {status && !status.configured ? <Text style={[xs.slabNote, { color: x.mute }]}>{X_LINK_STATUS.unavailable}</Text> : vButton(X_CARD.connectX, () => go(TRADE_FROM_X))}
          {err ? <Text style={[xs.err, { color: x.v }]}>{err}</Text> : null}
        </View>
      );
    }
  }

  const foot = link.loading
    ? X_CARD.checking
    : binding && !link.needsLink && !link.walletMismatch && permission === "ready"
      ? X_CARD.howTo(X_HANDLE)
      : connected
        ? "Complete the steps above before tweeting a trade."
        : null;

  const body = (
    <>
      {slab}
      {!address ? (
        <Text style={[styles.connectNote, { color: x.mute }]}>{X_CARD.connectWallet}</Text>
      ) : (
        <>
          <View style={styles.balanceRow}>
            <View>
              {!compact ? (
                <>
                  <Text style={[styles.balanceLabel, { color: x.mute }]}>{X_CARD.balanceLabel}</Text>
                  <Text style={[styles.balance, { color: x.v }]}>
                    {shownBalance}
                    <Text style={[styles.balanceUnit, { color: x.mute }]}>{`  ${symbol}`}</Text>
                  </Text>
                </>
              ) : null}
            </View>
            {balance !== null && balance > 0n ? (
              <Pressable
                onPress={() => void grant.cashOut()}
                disabled={busy !== "" || !grant.readable || Boolean(grant.pendingUpdate)}
                accessibilityRole="button"
                style={[styles.out, { borderColor: x.line }, (busy !== "" || !grant.readable || Boolean(grant.pendingUpdate)) && styles.dim]}
              >
                <Text style={[styles.outText, { color: x.ink }]}>{grant.busy === "cashout" ? X_CARD.cashingOut : X_CARD.cashOut} ↗</Text>
              </Pressable>
            ) : null}
          </View>
          <XPermission grant={grant} executor={executor} symbol={symbol} disabled={link.walletMismatch || Boolean(link.busy)} />
          {canFund ? (
            <XFund
              amount={amount}
              setAmount={setAmount}
              source={source}
              setSource={setSource}
              availableBase={grant.availableBase}
              decimals={grant.decimals}
              symbol={symbol}
              busy={Boolean(busy)}
              fundBusy={grant.busy === "fund"}
              fundDisabled={busy !== "" || !grant.readable || link.walletMismatch}
              onFund={fund}
            />
          ) : null}
          {grant.deployed === false ? <Text style={[xs.err, { color: x.v }]}>{X_CARD.notDeployed}</Text> : null}
          {err ? <Text style={[xs.err, { color: x.v }]} accessibilityRole="alert">{err}</Text> : null}
          {ok ? <Text style={[xs.err, { color: x.mint }]}>{ok}</Text> : null}
        </>
      )}
      <Text style={[xs.foot, { borderTopColor: x.line, color: x.mute }]}>{foot}</Text>
    </>
  );

  if (compact) return <View>{body}</View>;
  return (
    <View>
      <View style={styles.head}>
        <XGlyph color={x.v} />
        <Text style={[styles.title, { color: x.ink }]} accessibilityRole="header">
          {X_CARD.title}
        </Text>
      </View>
      <View style={[styles.plate, { backgroundColor: x.plate }]}>
        <PlateTicks color={x.line} />
        {body}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4, letterSpacing: 0.35, textTransform: "uppercase" },
  plate: { borderRadius: 5, paddingVertical: 16, paddingHorizontal: 14, overflow: "hidden" },
  mt10: { marginTop: 10 },
  conn: { marginBottom: 16 },
  connRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 2, borderRadius: 8, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12 },
  handle: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  chev: { marginLeft: "auto" },
  chevOpen: { transform: [{ rotate: "180deg" }] },
  manage: { marginTop: 8, gap: 8, borderRadius: 8, borderWidth: 1, padding: 8 },
  stretch: { alignSelf: "stretch" },
  loss: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  half: { opacity: 0.5 },
  connectNote: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.4 },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 },
  balanceLabel: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  balance: { marginTop: 4, fontFamily: FONT.dataStrong, fontSize: 30, lineHeight: 36, fontVariant: ["tabular-nums"] },
  balanceUnit: { fontFamily: FONT.dataRegular, fontSize: 14 },
  out: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 20 },
  outText: { fontFamily: FONT.heading, fontSize: 12, lineHeight: 19.2, letterSpacing: 1.2, textTransform: "uppercase" },
  dim: { opacity: 0.4 },
});
