import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Switch, Text, View } from "react-native";
import { setBetAgainst, useBetAgainst } from "@/features/markets/bet-against";
import { PRIVATE } from "@/features/private/copy";
import { SESSION } from "@/features/session/copy";
import type { FundingSource } from "@/features/session/useTicketRoute";
import { TICKET, TICKET_PENDING } from "@/lib/copy";
import { Button, haptic, Segmented } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";

export type BetMode = "dir" | "range";

/**
 * web's BetModes: call a side, or call a band. Range settles against the RangeReserve; where it is not deployed the
 * choice stays and says what is missing, because an Up/Down order under its label would be a different bet.
 */
export function BetModes({ mode, onChange, rangeAvailable }: { mode: BetMode; onChange: (mode: BetMode) => void; rangeAvailable: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.stack}>
      <Segmented
        label={TICKET_PENDING.modeLabel}
        value={mode}
        onChange={(next) => (next === "range" && !rangeAvailable ? haptic.error() : onChange(next))}
        options={[
          { value: "dir", label: TICKET_PENDING.modeDirection },
          { value: "range", label: TICKET_PENDING.modeRange },
        ]}
      />
      {!rangeAvailable ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{TICKET_PENDING.rangePending}</Text> : null}
    </View>
  );
}

/** web's BetAgainstToggle (A-1a): DOWN first everywhere and every ticket opening on DOWN — the same Window and book. */
export function BetAgainstToggle() {
  const { color } = useTheme();
  const on = useBetAgainst();
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{TICKET.betAgainst}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{on ? TICKET.betAgainstOn : TICKET.betAgainstOff}</Text>
      </View>
      <Switch
        value={on}
        onValueChange={(next) => {
          haptic.select();
          setBetAgainst(next);
        }}
        trackColor={{ true: color.loss, false: color.surface3 }}
        accessibilityLabel={TICKET.betAgainst}
      />
    </View>
  );
}

/**
 * web's PublicPrivate: two options, and the one line that matters. Private is disabled with its reason while the desk
 * is probing, unavailable or the stake is over its cap; "retry" asks the desk again.
 */
export function PublicPrivate({ priv, onChange, privateEnabled, privateTitle, retry }: {
  priv: boolean;
  onChange: (priv: boolean) => void;
  privateEnabled: boolean;
  privateTitle: string;
  retry: (() => void) | null;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.stack}>
      <Segmented
        label={TICKET.route}
        value={priv ? "private" : "public"}
        onChange={(next) => {
          if (next === "private" && !privateEnabled) {
            haptic.error();
            return;
          }
          onChange(next === "private");
        }}
        options={[
          { value: "public", label: TICKET.public },
          { value: "private", label: TICKET.private },
        ]}
      />
      <View style={styles.titleRow}>
        {/* Chosen, the private note below says the same honest line; the title here is for the choice, not the bet. */}
        {priv ? <View style={styles.grow} /> : <Text style={[TYPE.caption, styles.grow, { color: privateEnabled ? color.inkMuted : color.inkSecondary }]}>{privateTitle}</Text>}
        {retry ? <Button label={PRIVATE.route.retry} variant="ghost" size="sm" block={false} onPress={retry} /> : null}
      </View>
    </View>
  );
}

/** web's RouteControl: the escrow from the wallet, or the Trading Balance where one is funded; armed, the Vault is shown, not offered. */
export function RouteChoice({ source, onChange, vaultAvailableBase, decimals, symbol, armed, deployed }: {
  source: FundingSource;
  onChange: (source: FundingSource) => void;
  vaultAvailableBase: bigint | null;
  decimals: number;
  symbol: string;
  armed: boolean;
  deployed: boolean;
}) {
  const { color } = useTheme();
  const vaultEmpty = (vaultAvailableBase ?? 0n) === 0n;
  const effective: FundingSource = armed && source !== "private" ? "vault" : source;
  const vaultTitle = !deployed ? SESSION.notDeployed : vaultEmpty && !armed ? SESSION.route.vaultEmpty : `${formatBaseUnits(vaultAvailableBase ?? 0n, decimals)} ${symbol}`;
  return (
    <View style={styles.stack}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{SESSION.route.label}</Text>
      <Segmented
        label={SESSION.route.label}
        value={effective === "private" ? "wallet" : effective}
        onChange={(next) => {
          if (armed || (next === "vault" && (!deployed || vaultEmpty))) {
            haptic.error();
            return;
          }
          onChange(next);
        }}
        options={[
          { value: "wallet", label: SESSION.route.wallet },
          { value: "vault", label: SESSION.route.vault },
        ]}
      />
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{armed ? SESSION.route.armedLocked : vaultTitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 6 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchCopy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 },
});
