import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { formatAccountAddress } from "@/providers/wallet/emoji-avatar";
import { useWalletSession } from "@/lib/wallet-session";
import { useAccountBalances } from "~/components/wallet/account-rows";
import { Avatar } from "~/components/wallet/Avatar";
import { RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** web's AccountModal as a sheet: avatar, the address, the account's balances, Copy Address and Disconnect. */
export default function AccountSheet() {
  const { color } = useTheme();
  const session = useWalletSession();
  const balances = useAccountBalances();
  const [copied, setCopied] = useState(false);
  if (!session.address) return null;
  const address = session.address;

  return (
    <View style={[styles.body, { backgroundColor: color.ground }]}>
      <Avatar address={address} size={74} />
      <Text style={[TYPE.title, { color: color.ink }]}>{formatAccountAddress(address)}</Text>
      <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        {balances.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={[TYPE.body, { color: color.inkSecondary }]}>{row.label}</Text>
            <Text style={[TYPE.dataLg, { color: color.ink }]}>{row.amount}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Action label={copied ? WALLET_MODAL.profile.copied : WALLET_MODAL.profile.copy} onPress={() => { Clipboard.setStringAsync(address); Haptics.selectionAsync(); setCopied(true); }} />
        <Action label={WALLET_MODAL.profile.disconnect} danger onPress={() => { void session.disconnect(); router.back(); }} />
      </View>
    </View>
  );
}

function Action({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, { backgroundColor: pressed ? color.surface2 : color.surface1, borderColor: color.hairline }]}>
      <Text style={[TYPE.bodyStrong, { color: danger ? color.loss : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: "center", padding: SPACE.gutter, paddingTop: 28, gap: 14 },
  card: { alignSelf: "stretch", borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actions: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  action: { flex: 1, height: 48, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
});
