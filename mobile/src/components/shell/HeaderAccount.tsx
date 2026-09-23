import { Button, Divider, Host, Menu, RNHostView, Section } from "@expo/ui/swift-ui";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { ACCOUNT_MENU, CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { useAccountBalances } from "~/components/wallet/account-rows";
import { Avatar } from "~/components/wallet/Avatar";
import { FONT, RADIUS, useTheme } from "~/theme";

/**
 * web's HeaderAccount on the phone: "Connect" until a wallet is connected, then the account's avatar opening web's
 * menu — the two balance rows, Portfolio, Disconnect — as the system dropdown (iOS), or the account sheet (Android).
 */
export function HeaderAccount() {
  const session = useWalletSession();
  const { color } = useTheme();

  if (!session.isConnected || !session.address) {
    return (
      <Pressable onPress={session.connect} accessibilityRole="button" style={({ pressed }) => [styles.connect, { backgroundColor: pressed ? color.accentPressed : color.accent }]}>
        <Text style={[styles.connectText, { color: color.onAccent }]}>{session.connecting ? CONNECT.connecting : CONNECT.connect}</Text>
      </Pressable>
    );
  }
  if (Platform.OS !== "ios") {
    return (
      <Pressable onPress={session.openAccount} accessibilityRole="button" accessibilityLabel={ACCOUNT_MENU.open}>
        <Avatar address={session.address} />
      </Pressable>
    );
  }
  return <AccountMenu address={session.address} disconnect={session.disconnect} />;
}

function AccountMenu({ address, disconnect }: { address: string; disconnect: () => Promise<void> }) {
  const balances = useAccountBalances();
  return (
    <Host matchContents>
      <Menu label={<RNHostView matchContents><Avatar address={address} /></RNHostView>}>
        <Section title={`${address.slice(0, 4)}…${address.slice(-4)}`}>
          {balances.map((row) => <Button key={row.label} label={`${row.label}   ${row.amount}`} />)}
        </Section>
        <Button label="Add funds" systemImage="plus.circle" onPress={() => router.push("/funds")} />
        <Button label={WALLET_MODAL.profile.copy} systemImage="doc.on.doc" onPress={() => { Clipboard.setStringAsync(address); Haptics.selectionAsync(); }} />
        <Button label={ACCOUNT_MENU.portfolio} systemImage="wallet.bifold" onPress={() => router.navigate("/portfolio")} />
        <Divider />
        <Button label={CONNECT.disconnect} systemImage="rectangle.portrait.and.arrow.right" role="destructive" onPress={() => void disconnect()} />
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  connect: { paddingHorizontal: 16, height: 34, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" },
  connectText: { fontFamily: FONT.bodyStrong, fontSize: 14 },
});
