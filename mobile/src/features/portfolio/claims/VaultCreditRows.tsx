import { formatCadence } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { useVaultSnapshot, useWalletHistory } from "@agari/markets/react";
import { StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { VAULT } from "@/features/vault/copy";
import { useVaultWrite } from "@/features/vault/useVaultWrite";
import { CLAIM } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { useTheme } from "~/theme";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { VaultButton, vaultStyles } from "../vault/parts";

/**
 * web `VaultCreditRows`: the Trading Balance's side of collecting. A vault credit is a withdrawal, not a redeem (AD-1),
 * so nothing here joins Claim all; settled Windows the vault still holds get their permissionless crank.
 */
export function VaultCreditRows() {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const snapshot = useVaultSnapshot(address);
  const history = useWalletHistory(address);
  const { state, run } = useVaultWrite();
  const vault = snapshot && isOk(snapshot) ? snapshot.value : null;
  if (!address || !vault) return null;
  const pending = history && isOk(history) ? history.value.rounds.filter((r) => r.source === "vault" && r.claim === "to-collect") : [];
  const credit = vault.account.availableBase;
  if (pending.length === 0 && credit === 0n) return null;
  const box = [styles.item, { borderColor: color.hairline, backgroundColor: color.surface1 }];
  return (
    <View style={styles.section} accessibilityLabel={VAULT.claims.title}>
      <Text style={[vaultStyles.eyebrow, { color: color.inkSecondary }]}>{VAULT.claims.title}</Text>
      <View style={styles.list}>
        {credit > 0n ? (
          <View style={box}>
            <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>
              <Text style={{ color: color.ink }}>{CLAIM.kind["vault-credit"]}</Text> · {VAULT.claims.credit(`${formatBaseUnits(credit, vault.decimals)} ${symbol}`.trim())}
            </Text>
            <Text style={[WEB_TYPE.labelMicro, { color: color.accent }]}>{VAULT.claims.withdrawOn}</Text>
          </View>
        ) : null}
        {pending.length > 0 ? <Text style={[WEB_TYPE.caption, { color: color.inkMuted }]}>{VAULT.claims.waiting(pending.length)}</Text> : null}
        {pending.map((round) => (
          <View key={round.marketId} style={box}>
            <Text style={[WEB_TYPE.caption, styles.shrink, { color: color.inkSecondary }]}>
              <Text style={{ color: color.ink }}>
                {round.asset} · {formatCadence(round.intervalSec)}
              </Text>{" "}
              · {VAULT.rounds.via} · {VAULT.rounds.crankNote}
            </Text>
            <VaultButton
              label={state.busy === "vault-crank-settle" ? VAULT.rounds.cranking : VAULT.rounds.crank}
              kind="outline"
              disabled={state.busy !== null}
              onPress={() => void run({ kind: "vault-crank-settle", owner: address, marketId: round.marketId }, VAULT.rounds.cranked)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  list: { marginTop: 8, gap: 8 },
  item: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, rowGap: 4, borderRadius: 8, borderWidth: 1, padding: 12 },
  shrink: { flexShrink: 1 },
});
