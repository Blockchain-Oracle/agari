import { formatBaseUnits, parseDecimalToBaseUnits, shortHex } from "@agari/core/units";
import * as Clipboard from "expo-clipboard";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { X_CARD, X_HANDLE, X_LINK_STATUS } from "@/features/x/copy";
import { useXGrant } from "@/features/x/useXGrant";
import { useXStatus } from "@/features/x/useXStatus";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Chips, Field, Segmented, type QuoteLine } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { go } from "./go";
import { SignSheet } from "./SignSheet";
import { usePlateInk } from "./usePlateInk";
import { afterCommit, useSignFlow, type WriteResult } from "./useSignFlow";
import { XPermission, permissionCopy } from "./XPermission";

const QUICK = ["5", "10", "25"] as const;
const TRADE_FROM_X = "/trade-from-x";

type Pending = { kind: "fund"; amountBase: bigint; source: "wallet" | "trading-balance" } | { kind: "cashout" } | { kind: "update" };

/**
 * web `XWalletCard compact` inside the plate's X row: who this balance bets for, its permission, Cash out (a revoke:
 * the budget returns to the Trading Balance) and Fund (from the wallet or the Trading Balance). Signing in with X is
 * an OAuth hand-off that lives on the native Trade-from-X screen, so every "connect X" state routes there.
 */
export function XPanel({ symbol }: { symbol: string }) {
  const { color } = useTheme();
  const ink = usePlateInk();
  const { address } = useWalletSession();
  const link = useXStatus();
  const grant = useXGrant();
  const flow = useSignFlow();
  const latest = useRef(grant);
  latest.current = grant;
  const [amount, setAmount] = useState("5");
  const [source, setSource] = useState<"wallet" | "trading-balance">("wallet");
  const [pending, setPending] = useState<Pending | null>(null);

  const status = link.status;
  const session = status?.session ?? null;
  const binding = status?.binding ?? null;
  const connected = Boolean(session || binding);
  const executor = status?.executor ?? null;
  const permission = grant.permission(executor);
  const canFund = ["ready", "unfunded"].includes(permission) && !grant.pendingUpdate;
  const busy = grant.busy || link.busy;
  const balance = grant.balanceBase;
  const m = (base: bigint) => `${formatBaseUnits(base, grant.decimals)} ${symbol}`;

  const ask = (next: Pending) => {
    setPending(next);
    flow.start();
  };
  const settle = (): WriteResult => {
    const now = latest.current;
    return now.error ? { landed: false, tone: "warn", text: now.error } : { landed: true, tone: "ok", text: now.ok || X_CARD.updated };
  };
  const confirm = () => {
    if (!pending) return;
    void flow.run(async () => {
      if (pending.kind === "fund") await grant.fund(pending.amountBase, executor, pending.source);
      else if (pending.kind === "cashout") await grant.cashOut();
      else await grant.update(executor);
      await afterCommit();
      return settle();
    });
  };
  const fund = () => {
    const base = parseDecimalToBaseUnits(amount || "0", grant.decimals);
    if (link.walletMismatch) return link.setError(X_CARD.wrongWalletFund);
    if (!base || base <= 0n) return link.setError(X_CARD.enterAmount);
    ask({ kind: "fund", amountBase: base, source });
  };

  return (
    <View style={styles.panel}>
      {link.loading ? <Text style={[TYPE.caption, { color: ink.mute }]}>{X_CARD.checking}</Text> : null}
      {!link.loading && link.walletMismatch && binding ? (
        <View style={[styles.slab, { borderColor: color.warning }]}>
          <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>{X_CARD.wrongWallet(binding.handle ?? "this X account")}</Text>
          <Text style={[TYPE.caption, { color: ink.mute }]}>
            {X_CARD.itBetsFrom} {shortHex(binding.wallet)}
            {X_CARD.connectedAs} {shortHex(address ?? "")}
            {X_CARD.strandedNote}
          </Text>
          <Button label={X_CARD.copyAddress(shortHex(binding.wallet))} variant="outline" size="sm" block={false} onPress={() => void Clipboard.setStringAsync(binding.wallet).then(() => link.setOk(X_CARD.copied))} />
        </View>
      ) : null}
      {!link.loading && !link.walletMismatch && link.needsLink && session ? (
        <View style={[styles.slab, { borderColor: ink.line }]}>
          <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>
            {binding ? X_CARD.switchQuestion(binding.handle ?? binding.authorId, session.handle ?? session.authorId) : X_CARD.oneMoreStep(session.handle ?? session.authorId)}
          </Text>
          {binding ? <Text style={[TYPE.caption, { color: ink.mute }]}>{X_CARD.switchNote}</Text> : null}
          <Button
            label={link.busy === "link" ? X_CARD.linking : binding ? X_CARD.useHandle(session.handle ?? session.authorId) : X_CARD.linkHandle(session.handle ?? session.authorId)}
            disabled={busy !== ""}
            onPress={() => void link.link()}
          />
        </View>
      ) : null}
      {!link.loading && !link.walletMismatch && !link.needsLink && connected ? (
        <View style={styles.row}>
          <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>{binding?.handle ? `@${binding.handle}` : X_CARD.xConnected}</Text>
          <Button label={X_CARD.switchAccount} variant="ghost" size="sm" block={false} onPress={() => go(TRADE_FROM_X)} />
        </View>
      ) : null}
      {!link.loading && !connected ? (
        <View style={[styles.slab, { borderColor: ink.line }]}>
          <Text style={[TYPE.bodyStrong, { color: ink.ink }]}>{balance && balance > 0n ? X_CARD.linkToBet : X_CARD.connectFirst}</Text>
          {status && !status.configured ? (
            <Text style={[TYPE.caption, { color: ink.mute }]}>{X_LINK_STATUS.unavailable}</Text>
          ) : (
            <Button label={X_CARD.connectX} icon={{ ios: "at", android: "alternate_email" }} variant="secondary" onPress={() => go(TRADE_FROM_X)} />
          )}
        </View>
      ) : null}

      {balance !== null && balance > 0n ? (
        <Button
          label={grant.busy === "cashout" ? X_CARD.cashingOut : `${X_CARD.cashOut} ${m(balance)}`}
          variant="outline"
          disabled={busy !== "" || !grant.readable || Boolean(grant.pendingUpdate)}
          onPress={() => ask({ kind: "cashout" })}
        />
      ) : null}

      <XPermission grant={grant} executor={executor} symbol={symbol} disabled={link.walletMismatch || Boolean(link.busy)} onUpdate={() => ask({ kind: "update" })} />

      {canFund ? (
        <View style={styles.fund}>
          {grant.availableBase !== null && grant.availableBase > 0n ? (
            <Segmented
              label="Fund from"
              value={source}
              onChange={setSource}
              options={[
                { value: "wallet", label: "Connected wallet" },
                { value: "trading-balance", label: `Trading Balance · ${formatBaseUnits(grant.availableBase, grant.decimals)}` },
              ]}
            />
          ) : null}
          <Chips options={QUICK.map((v) => ({ value: v, label: `$${v}` }))} value={amount} onPick={setAmount} />
          <Field label={X_CARD.amountAria} value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))} numeric suffix={symbol} />
          <Button label={grant.busy === "fund" ? X_CARD.funding : X_CARD.fund} disabled={busy !== "" || !grant.readable || link.walletMismatch} onPress={fund} />
        </View>
      ) : null}

      {grant.deployed === false ? <Text style={[TYPE.caption, { color: color.warning }]}>{X_CARD.notDeployed}</Text> : null}
      {grant.error || link.error ? <Text style={[TYPE.caption, { color: color.warning }]} accessibilityRole="alert">{grant.error || link.error}</Text> : null}
      {grant.ok || link.ok ? <Text style={[TYPE.caption, { color: ink.ink }]}>{grant.ok || link.ok}</Text> : null}
      {binding && !link.needsLink && !link.walletMismatch && permission === "ready" ? <Text style={[TYPE.caption, { color: ink.mute }]}>{X_CARD.howTo(X_HANDLE)}</Text> : null}

      <SignSheet
        visible={flow.open}
        onClose={flow.close}
        {...reviewOf(pending, m, balance, grant.availableBase, permissionCopy(grant, executor, symbol).title)}
        onConfirm={confirm}
        phase={flow.phase}
        outcome={flow.outcome}
      />
    </View>
  );
}

function reviewOf(pending: Pending | null, m: (base: bigint) => string, balance: bigint | null, available: bigint | null, updateTitle: string): { title: string; lines: QuoteLine[]; maxLoss: string | null; confirmLabel: string } {
  if (pending?.kind === "fund") {
    return {
      title: `Fund your X betting balance with ${m(pending.amountBase)}`,
      lines: [
        { label: "From", value: pending.source === "wallet" ? "Connected wallet" : "Trading Balance" },
        { label: "X balance after", value: m((balance ?? 0n) + pending.amountBase), tone: "accent" },
        ...(pending.source === "trading-balance" && available !== null ? [{ label: "Trading Balance after", value: m(available - pending.amountBase) }] : []),
      ],
      maxLoss: `${m(pending.amountBase)} · what X replies may stake`,
      confirmLabel: "Slide to fund",
    };
  }
  if (pending?.kind === "cashout") {
    return {
      title: "Cash out your X betting balance",
      lines: [
        { label: "Back to your Trading Balance", value: balance === null ? "—" : m(balance), tone: "accent" },
        { label: "X replies can bet after", value: "nothing until you fund again" },
      ],
      maxLoss: m(0n),
      confirmLabel: "Slide to cash out",
    };
  }
  return {
    title: updateTitle,
    lines: [{ label: "Your X funds", value: balance === null ? "—" : `${m(balance)} · reused, no new deposit` }],
    maxLoss: m(0n),
    confirmLabel: "Slide to update",
  };
}

const styles = StyleSheet.create({
  panel: { gap: 12, paddingTop: 4 },
  slab: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fund: { gap: 10 },
});
