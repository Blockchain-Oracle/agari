import { FAUCET_UNITS } from "@agari/core/constants";
import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFaucet } from "@/features/markets/faucet/useFaucet";
import { SESSION } from "@/features/session/copy";
import type { FundingSource } from "@/features/session/useTicketRoute";
import { diagnosisCopy, FAUCET, TICKET } from "@/lib/copy";
import type { WalletSession } from "@/lib/wallet-session";
import { FONT } from "~/theme";
import { ModeTile } from "./Controls";
import { ConnectButton, GateCta } from "./TicketButton";
import { tkType, useTk } from "./tk";
import { SessionControl } from "./session/SessionControl";

export interface RouteChoice {
  show: boolean;
  source: FundingSource;
  onChange: (source: FundingSource) => void;
  vaultAvailableBase: bigint | null;
  armed: boolean;
  deployed: boolean;
}

interface GateProps {
  session: WalletSession;
  availableBase: bigint | null;
  stakeBase: bigint;
  /** The seat deposit this order also funds (0 when the wallet already sits in the Window). */
  depositBase: bigint;
  decimals: number;
  symbol: string;
  balanceSource: "wallet" | "vault" | "private";
  route: RouteChoice | null;
}

/**
 * web's AccountGate, inline: connect when there is no wallet; "Top up to place this" when the stake and seat deposit
 * are more than the chosen source holds, with the fix right there (the funds sheet carries the faucet); connected, the
 * row with where a public bet is paid from and the tap-trading chip.
 */
export function AccountGate({ session, availableBase, stakeBase, depositBase, decimals, symbol, balanceSource, route }: GateProps) {
  const tk = useTk();
  const faucet = useFaucet();
  const connected = session.isConnected;
  const requiredBase = stakeBase > 0n ? stakeBase + depositBase : 0n;
  const short = connected && availableBase !== null && (availableBase === 0n || (stakeBase > 0n && requiredBase > availableBase));
  const needBase = availableBase !== null && requiredBase > availableBase ? requiredBase - availableBase : null;
  const wallet = balanceSource === "wallet";
  const balanceLabel = wallet ? "Wallet" : balanceSource === "private" ? "Private balance" : "Trading Balance";
  const openFunds = () => router.push("/funds");
  const tail = wallet
    ? needBase !== null
      ? ` ${depositBase > 0n ? TICKET.gate.needWithDeposit(formatBaseUnits(needBase, decimals), symbol, formatBaseUnits(depositBase, decimals)) : TICKET.gate.need(formatBaseUnits(needBase, decimals), symbol)}`
      : ` ${TICKET.gate.empty}`
    : balanceSource === "private"
      ? " Fund and authorize your private balance on Portfolio before placing a private bet."
      : " Add funds to your Trading Balance on Portfolio, or switch to Wallet.";

  return (
    <>
      {!connected ? (
        <View style={[styles.gate, { borderColor: tk.gateBorder, backgroundColor: tk.gateBg }]}>
          <Text style={[styles.body, { color: tk.gateBody }]}>{TICKET.gate.connect}</Text>
          <ConnectButton label={session.isConnecting ? "Reconnecting…" : "Connect"} busy={session.isConnecting} onPress={() => router.push("/connect")} />
        </View>
      ) : null}
      {short ? (
        <View style={[styles.gate, { borderColor: tk.warnBorder, backgroundColor: tk.warnBg }]} accessibilityRole="alert">
          <Text style={[styles.eyebrow, { color: tk.vermilion }]}>{TICKET.gate.topUp}</Text>
          <Text style={[styles.line, { color: tk.gateLine }]}>
            {TICKET.gate.holds(formatBaseUnits(availableBase ?? 0n, decimals), symbol, balanceLabel)}
            {tail}
          </Text>
          {faucet.state.diagnosis ? <Text style={[styles.line, { color: tk.gateLine }]}>{diagnosisCopy(faucet.state.diagnosis.kind).headline}</Text> : null}
          <View style={styles.actions}>
            {wallet ? (
              <GateCta label={TICKET.gate.addMoney} onPress={openFunds} />
            ) : (
              <GateCta label={balanceSource === "private" ? "Manage private balance" : "Manage Trading Balance"} onPress={() => router.navigate("/portfolio")} />
            )}
            {wallet && faucet.hasSigner ? <Quiet label={faucet.busy ? faucet.label : FAUCET.cta(String(FAUCET_UNITS))} disabled={faucet.busy} onPress={openFunds} /> : null}
          </View>
        </View>
      ) : null}
      {connected ? (
        <View style={styles.gateRow}>
          {route?.show ? <RouteControl route={route} decimals={decimals} symbol={symbol} /> : <View />}
          {balanceSource !== "private" ? <SessionControl symbol={symbol} /> : null}
        </View>
      ) : null}
    </>
  );
}

/** web's `.tk-gate-quiet`: the small mono secondary action. */
export function Quiet({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const tk = useTk();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={8} style={disabled && styles.half}>
      <Text style={[tkType.label, styles.quiet, { color: tk.gateQuiet }]}>{label}</Text>
    </Pressable>
  );
}

/** web's RouteControl: "Pay from" and the Wallet / Trading Balance tiles; armed, the Vault is shown, not offered. */
function RouteControl({ route, decimals, symbol }: { route: RouteChoice; decimals: number; symbol: string }) {
  const tk = useTk();
  const { source, onChange, vaultAvailableBase, armed, deployed } = route;
  const vaultEmpty = (vaultAvailableBase ?? 0n) === 0n;
  const effective: FundingSource = armed && source !== "private" ? "vault" : source;
  // web's title on the Vault tile: why it cannot be chosen, or what it holds — the tray's hint here.
  const vaultWhy = !deployed ? SESSION.notDeployed : vaultEmpty && !armed ? SESSION.route.vaultEmpty : `${formatBaseUnits(vaultAvailableBase ?? 0n, decimals)} ${symbol}`;
  return (
    <View style={styles.route}>
      <Text style={[tkType.label, { color: tk.label }]}>{SESSION.route.label}</Text>
      <View style={[styles.tray, { borderColor: tk.modesBorder, backgroundColor: tk.modesBg }]} accessibilityLabel={SESSION.route.label} accessibilityHint={vaultWhy}>
        <ModeTile label={SESSION.route.wallet} on={effective === "wallet"} disabled={armed} onPress={() => onChange("wallet")} />
        <ModeTile label={SESSION.route.vault} on={effective === "vault"} disabled={(armed && source !== "private") || !deployed || (vaultEmpty && !armed)} onPress={() => onChange("vault")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { borderWidth: 1, padding: 16 },
  body: { marginBottom: 12, fontFamily: FONT.body, fontSize: 12.5, lineHeight: 17.2 },
  eyebrow: { marginBottom: 6, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase" },
  line: { marginBottom: 10, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 15 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  quiet: { letterSpacing: 1.26 },
  half: { opacity: 0.5 },
  gateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  route: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  tray: { flex: 1, flexDirection: "row", gap: 4, borderRadius: 6, borderWidth: 1, padding: 4 },
});
