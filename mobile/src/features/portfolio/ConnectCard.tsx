import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { PLATE } from "@/features/markets/portfolio/plate/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { usePortfolioTokens, WebButton } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";

/**
 * web `ConnectCard` (ledger-plate.css `.connect-card`): the disconnected Portfolio — a hairline box on the ground, the
 * 64 pt ring with its drawn card glyph, "Connect Wallet", web's Connect button, and the quiet "New to Solana?" link.
 */
export function ConnectCard() {
  const { color } = useTheme();
  const t = usePortfolioTokens();
  const session = useWalletSession();
  return (
    <View style={[styles.card, { backgroundColor: color.ground, borderColor: color.hairline }]}>
      <View style={[styles.ring, { borderColor: color.hairline }]}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={t.ringInk} strokeWidth={1.5}>
          <Rect x={2} y={6} width={20} height={14} rx={2} />
          <Path d="M22 10H2" />
        </Svg>
      </View>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {PLATE.connect.title}
      </Text>
      <View style={styles.actions}>
        <WebButton label={session.isConnecting ? "Connecting…" : "Connect"} disabled={session.isConnecting} onPress={() => router.push("/connect")} />
        <Pressable onPress={() => router.push("/how-it-works")} accessibilityRole="link" hitSlop={8}>
          <Text style={[styles.link, { color: t.linkInk }]}>{PLATE.connect.newHere}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 4, padding: 40, alignItems: "center" },
  ring: { width: 64, height: 64, marginBottom: 24, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  title: { marginBottom: 24, fontFamily: FONT.heading, fontSize: 20, lineHeight: 32, textAlign: "center" },
  actions: { alignItems: "center", gap: 12 },
  link: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6, textAlign: "center" },
});
