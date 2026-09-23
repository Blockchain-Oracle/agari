import { ownCentsOf } from "@agari/core/orders";
import { SUBMITTED_UNKNOWN } from "@agari/core/copy";
import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type { PlaceBetState } from "@/features/markets/ticket/usePlaceBet";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { PREOPEN, TICKET } from "@/lib/copy";
import type { WalletSession } from "@/lib/wallet-session";
import { Button, ErrorState } from "~/components/kit";
import { explorerUrl, openExternal } from "~/lib/external";
import { RADIUS, TYPE, useTheme } from "~/theme";

interface GateProps {
  session: WalletSession;
  availableBase: bigint | null;
  stakeBase: bigint;
  /** The seat deposit this order also funds (0 when the wallet already sits in the Window). */
  depositBase: bigint;
  decimals: number;
  symbol: string;
  balanceSource: "wallet" | "vault" | "private";
}

/**
 * web's AccountGate, inline in the ticket: connect when there is no wallet; "Top up to place this" when the stake and
 * seat deposit are more than the chosen source holds, with the fix right there (the funds sheet carries the faucet).
 */
export function AccountGate({ session, availableBase, stakeBase, depositBase, decimals, symbol, balanceSource }: GateProps) {
  const { color } = useTheme();
  const connected = session.isConnected;
  const requiredBase = stakeBase > 0n ? stakeBase + depositBase : 0n;
  const short = connected && availableBase !== null && (availableBase === 0n || (stakeBase > 0n && requiredBase > availableBase));
  const needBase = availableBase !== null && requiredBase > availableBase ? requiredBase - availableBase : null;
  const wallet = balanceSource === "wallet";
  const label = wallet ? "Wallet" : balanceSource === "private" ? "Private balance" : "Trading Balance";

  if (!connected) {
    return (
      <View style={[styles.gate, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{TICKET.gate.connect}</Text>
        <Button label={session.isConnecting ? "Reconnecting…" : "Connect"} loading={session.isConnecting} onPress={() => router.push("/connect")} />
      </View>
    );
  }
  if (!short) return null;
  const line = wallet
    ? needBase !== null
      ? depositBase > 0n
        ? TICKET.gate.needWithDeposit(formatBaseUnits(needBase, decimals), symbol, formatBaseUnits(depositBase, decimals))
        : TICKET.gate.need(formatBaseUnits(needBase, decimals), symbol)
      : TICKET.gate.empty
    : balanceSource === "private"
      ? "Fund and authorize your private balance on Portfolio before placing a private bet."
      : "Add funds to your Trading Balance on Portfolio, or switch to Wallet.";
  return (
    <View style={[styles.gate, { borderColor: color.warning, backgroundColor: color.surface1 }]} accessibilityRole="alert">
      <Text style={[TYPE.labelMicro, { color: color.warning }]}>{TICKET.gate.topUp}</Text>
      <Text style={[TYPE.body, { color: color.ink }]}>
        {TICKET.gate.holds(formatBaseUnits(availableBase ?? 0n, decimals), symbol, label)} {line}
      </Text>
      {wallet ? (
        <Button label={TICKET.gate.addMoney} size="sm" onPress={() => router.push("/funds")} />
      ) : (
        <Button label={balanceSource === "private" ? "Manage private balance" : "Manage Trading Balance"} size="sm" variant="secondary" onPress={() => router.push("/portfolio")} />
      )}
    </View>
  );
}

/** web's OutcomeNote: what the chain said about the last send — never a revert shown as success. */
export function OutcomeNote({ state, decimals, symbol, onDismiss }: { state: PlaceBetState; decimals: number; symbol: string; onDismiss: () => void }) {
  const { color } = useTheme();
  const { outcome, txHash } = state;
  const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0 });
  const line = (text: string, tx: string | null | undefined) => (
    <View style={[styles.note, { borderColor: color.hairline, backgroundColor: color.surface2 }]} accessibilityRole="text" accessibilityLiveRegion="polite">
      <Text style={[TYPE.caption, { color: color.ink }]}>{text}</Text>
      {tx ? (
        <Text style={[TYPE.caption, { color: color.accent }]} onPress={() => openExternal(explorerUrl("tx", tx))} accessibilityRole="link">
          {TICKET.txLabel}
        </Text>
      ) : null}
    </View>
  );
  if (state.phase === "unknown") return line(SUBMITTED_UNKNOWN, txHash);
  if (!outcome) return null;
  switch (outcome.status) {
    case "confirmed":
      return line(`${TICKET.bookedPrefix} ${contracts(outcome.booked.contractsRaw)} ${SIDE_WORD[outcome.booked.side]} ${TICKET.bookedAt} ${Math.round(outcome.booked.avgPriceBps / 100)}¢ · ${formatBaseUnits(outcome.booked.costBase, decimals)} ${symbol}`, outcome.booked.txHash);
    case "resting":
      return line(PREOPEN.ticket.resting(contracts(outcome.rested.contractsRaw), SIDE_WORD[outcome.rested.side], ownCentsOf(outcome.rested.side, outcome.rested.priceTicks)), outcome.rested.txHash);
    case "nothingFilled":
      return line(TICKET.nothingFilled, outcome.txHash);
    case "requote":
      return line(`${TICKET.requotePrefix} ${formatBaseUnits(outcome.quote.maxCostBase, decimals)} ${symbol}. ${TICKET.requoteSuffix}`, null);
    case "reverted":
    case "refused":
      return <ErrorState diagnosis={outcome.diagnosis} retry={onDismiss} />;
    case "unknown":
      return line(SUBMITTED_UNKNOWN, outcome.txHash ?? null);
  }
}

const styles = StyleSheet.create({
  gate: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 10 },
  note: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 10, gap: 4 },
});
