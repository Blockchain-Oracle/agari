import { formatCadence } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import { useVaultSnapshot, useWalletHistory } from "@agari/markets/react";
import { StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { VAULT } from "@/features/vault/copy";
import { CLAIM } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { CrankButton } from "./CrankButton";
import { money } from "./format";

/**
 * web `VaultCreditRows`: the Trading Balance's side of collecting. A vault credit is a withdrawal, not a redeem (AD-1),
 * so nothing here joins Claim all — the credit already sitting in the balance says where to withdraw it (the plate's
 * Trading Balance disclosure above), and each settled Window the vault still holds gets its permissionless settle.
 */
export function VaultCredits() {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const snapshot = useVaultSnapshot(address);
  const history = useWalletHistory(address);
  const vault = snapshot && isOk(snapshot) ? snapshot.value : null;
  if (!address || !vault) return null;
  const pending = history && isOk(history) ? history.value.rounds.filter((r) => r.source === "vault" && r.claim === "to-collect") : [];
  const credit = vault.account.availableBase;
  if (pending.length === 0 && credit === 0n) return null;

  return (
    <View style={styles.section} accessibilityLabel={VAULT.claims.title}>
      <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{VAULT.claims.title}</Text>
      {credit > 0n ? (
        <View style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            <Text style={{ color: color.ink }}>{CLAIM.kind["vault-credit"]}</Text> · {VAULT.claims.credit(money(credit, vault.decimals, symbol))}
          </Text>
          <Text style={[TYPE.caption, { color: color.accent }]}>Withdraw it from the Trading Balance row above.</Text>
        </View>
      ) : null}
      {pending.length > 0 ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{VAULT.claims.waiting(pending.length)}</Text> : null}
      {pending.map((round) => (
        <View key={round.marketId} style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            <Text style={{ color: color.ink }}>{round.asset} · {formatCadence(round.intervalSec)}</Text> · {VAULT.rounds.via} · {VAULT.rounds.crankNote}
          </Text>
          <CrankButton round={round} symbol={symbol} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase" },
  row: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
});
