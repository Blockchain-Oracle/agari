import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PLATE } from "@/features/markets/portfolio/plate/copy";
import { X_CARD } from "@/features/x/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Card } from "~/components/kit";
import { Logo } from "~/components/logos/Logo";
import { RADIUS, TYPE, useTheme } from "~/theme";

/**
 * web `ConnectCard` (reference `portfolio/page.tsx` L277–292): the disconnected Portfolio — connecting a wallet is
 * what the page is FOR. The ring and its card glyph, the title, Connect (the app's own /connect sheet), "New to Solana?".
 */
export function ConnectCard() {
  const { color } = useTheme();
  const session = useWalletSession();
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={[styles.ring, { borderColor: color.borderStrong }]}>
        <SymbolView name={{ ios: "creditcard", android: "credit_card" }} size={24} tintColor={color.ink} />
      </View>
      <Text style={[TYPE.title, { color: color.ink }]} accessibilityRole="header">
        {PLATE.connect.title}
      </Text>
      <Button
        label={session.isConnecting ? "Reconnecting…" : "Connect"}
        loading={session.isConnecting}
        onPress={() => router.push("/connect")}
        block={false}
        style={styles.button}
      />
      <Pressable onPress={() => router.push("/how-it-works")} accessibilityRole="link" hitSlop={10}>
        <Text style={[TYPE.caption, { color: color.accent }]}>{PLATE.connect.newHere}</Text>
      </Pressable>
    </View>
  );
}

/** web renders the X wallet card under the connect card (reference page L277–294); with no wallet it says what it needs. */
export function XWalletNote() {
  const { color } = useTheme();
  return (
    <Card>
      <View style={styles.xHead}>
        <Logo brand="x" size={18} />
        <Text style={[TYPE.title, { color: color.ink }]}>{X_CARD.title}</Text>
      </View>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{X_CARD.connectWallet}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  xHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 32, paddingHorizontal: 20, gap: 16, alignItems: "center" },
  ring: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  button: { minWidth: 180 },
});
