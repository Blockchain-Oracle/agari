import { Smartphone } from "lucide-react-native";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { haptic } from "~/components/kit";
import { Logo } from "~/components/logos/Logo";
import type { BrandLogo } from "~/components/logos/brand-logos";
import { AgariMark } from "~/components/shell/AgariMark";
import { ActionButton, Spinner, WalletIcon } from "~/components/wallet/sheet-parts";
import { openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { WALLET_CHOICES, type WalletChoice, type WalletKind } from "~/wallet/choices";

const T = WALLET_MODAL;

/** Where each wallet app is downloaded on this phone's store (web's KNOWN_WALLETS, as store pages). */
export const GET_WALLETS: readonly { name: string; logo: BrandLogo; url: string }[] = Platform.select({
  android: [
    { name: "Phantom", logo: "phantom" as const, url: "https://play.google.com/store/apps/details?id=app.phantom" },
    { name: "Solflare", logo: "solflare" as const, url: "https://play.google.com/store/apps/details?id=com.solflare.mobile" },
    { name: "Backpack", logo: "backpack" as const, url: "https://backpack.app/download" },
  ],
  default: [
    { name: "Phantom", logo: "phantom" as const, url: "https://apps.apple.com/app/phantom-crypto-wallet/id1598432977" },
    { name: "Solflare", logo: "solflare" as const, url: "https://apps.apple.com/app/solflare-solana-wallet/id1580902717" },
    { name: "Backpack", logo: "backpack" as const, url: "https://backpack.app/download" },
  ],
})!;

/** A wallet's 60 pt art: its brand mark, Android's chooser glyph, or the Agari mark for the practice key. */
export function ChoiceArt({ choice, size }: { choice: WalletChoice; size: 44 | 60 }) {
  const { color } = useTheme();
  if (choice.logo) return <Logo brand={choice.logo} size={size} radius={size === 60 ? 13 : 10} />;
  return (
    <View style={[styles.glyph, { width: size, height: size, borderRadius: size === 60 ? 13 : 10, backgroundColor: color.surface2 }]}>
      {choice.kind === "practice" ? <AgariMark width={size * 0.45} height={size * 0.45} /> : <Smartphone size={size * 0.45} color={color.accent} />}
    </View>
  );
}

/**
 * web `WalletPickerPhone` (RainbowKit's `MobileOptions`), the connect step: the wallets as a strip of 60 pt app icons
 * ("Recent" under the last one used; a spinner rings the one connecting), the divider, "What is a Wallet?", and
 * Get a Wallet / Learn More. The app's wallets are the ones a phone can reach: the apps by link, and a practice key.
 */
export function Choose({ recent, connecting, onChoose, onGet }: { recent: WalletKind | null; connecting: WalletKind | null; onChoose: (kind: WalletKind) => void; onGet: () => void }) {
  const { color } = useTheme();
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {WALLET_CHOICES.map((choice) => (
          <Pressable
            key={choice.kind}
            disabled={connecting !== null}
            onPress={() => {
              haptic.tap();
              onChoose(choice.kind);
            }}
            accessibilityRole="button"
            accessibilityLabel={choice.name}
            accessibilityHint={choice.line}
            style={({ pressed }) => [styles.tile, pressed && styles.shrink]}
          >
            <View style={styles.tileArt}>
              {connecting === choice.kind ? (
                <View style={styles.tileSpin}>
                  <Spinner size={72} tint={color.accent} />
                </View>
              ) : null}
              <ChoiceArt choice={choice} size={60} />
            </View>
            {connecting !== choice.kind ? (
              <>
                <Text style={[styles.tileName, { color: color.ink }]} numberOfLines={2}>
                  {choice.name}
                </Text>
                {recent === choice.kind ? <Text style={[styles.recent, { color: color.accent }]}>{T.recent}</Text> : null}
              </>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      <View style={[styles.divider, { backgroundColor: color.hairline }]} />
      <View style={styles.intro}>
        <Text style={[styles.introTitle, { color: color.ink }]}>{T.intro.title}</Text>
        <Text style={[styles.introBody, { color: color.inkSecondary }]}>{T.intro.description}</Text>
      </View>
      <View style={styles.actions}>
        <ActionButton secondary size="large" label={T.intro.get} onPress={onGet} />
        <ActionButton secondary size="large" label={T.learnMore} onPress={() => void openExternal(T.learnMoreUrl)} />
      </View>
    </View>
  );
}

/** web's phone "Get a Wallet" step (`.wm-m-get`): 48 pt icon, the name at 18, a small GET, hairlines between. */
export function GetWallet() {
  const { color } = useTheme();
  return (
    <View>
      <View style={styles.get}>
        {GET_WALLETS.map((wallet, index) => (
          <View key={wallet.name} style={styles.getRow}>
            <WalletIcon size={48}>
              <Logo brand={wallet.logo} size={48} />
            </WalletIcon>
            <View style={styles.getMain}>
              <View style={styles.getLine}>
                <Text style={[styles.getName, { color: color.ink }]}>{wallet.name}</Text>
                <ActionButton secondary size="small" label={T.get.action} onPress={() => void openExternal(wallet.url)} />
              </View>
              {index < GET_WALLETS.length - 1 ? <View style={[styles.getSep, { backgroundColor: color.hairline }]} /> : null}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.looking}>
        <Text style={[styles.introTitle, { color: color.ink }]}>{T.get.lookingTitle}</Text>
        <Text style={[styles.introBody, { color: color.inkSecondary }]}>{T.get.lookingBody}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // .wm-m-strip: padding 6 20 20, gap (100% − 40 − 240 + 47) / 4 ≈ 42 at 402 pt
  strip: { flexDirection: "row", justifyContent: "flex-start", paddingTop: 6, paddingHorizontal: 20, paddingBottom: 20, gap: 42 },
  tile: { width: 60, alignItems: "center" },
  shrink: { transform: [{ scale: 0.95 }] },
  tileArt: { alignItems: "center", justifyContent: "center", paddingTop: 10, paddingBottom: 8 },
  tileSpin: { position: "absolute", top: 4, left: -6, width: 72, height: 72 },
  tileName: { fontFamily: FONT.bodyMedium, fontSize: 13, textAlign: "center", width: 60 },
  recent: { fontFamily: FONT.bodyMedium, fontSize: 12, lineHeight: 12, marginTop: 1 },
  glyph: { alignItems: "center", justifyContent: "center" },
  divider: { height: 1, marginTop: -1, marginBottom: 32 },
  intro: { alignItems: "center", gap: 8, paddingHorizontal: 32 },
  introTitle: { fontFamily: FONT.bodyBold, fontSize: 16, lineHeight: 20, textAlign: "center" },
  introBody: { fontFamily: FONT.body, fontSize: 16, lineHeight: 20, textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "center", gap: 14, paddingTop: 32, paddingHorizontal: 20 },
  get: { alignItems: "center", marginTop: 5, marginBottom: 36, paddingTop: 12 },
  getRow: { flexDirection: "row", gap: 16, alignSelf: "stretch", paddingHorizontal: 20 },
  getMain: { flex: 1 },
  getLine: { flexDirection: "row", alignItems: "center", height: 48 },
  getName: { flex: 1, fontFamily: FONT.bodyBold, fontSize: 18 },
  getSep: { height: 1, marginVertical: 10 },
  looking: { gap: 12, marginTop: 42 - 36, paddingHorizontal: 36 },
});
