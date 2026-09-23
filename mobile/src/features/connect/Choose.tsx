import { SymbolView } from "expo-symbols";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { Button, haptic } from "~/components/kit";
import { Logo } from "~/components/logos/Logo";
import type { BrandLogo } from "~/components/logos/brand-logos";
import { AgariMark } from "~/components/shell/AgariMark";
import { openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { WALLET_CHOICES, type WalletKind } from "~/wallet/choices";

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

/**
 * web's WalletPickerPhone (RainbowKit's MobileOptions): the wallet apps as a strip of app icons with a "Recent" tag,
 * then the practice wallet for anyone without one, then "What is a Wallet?" with Get a Wallet / Learn More.
 */
export function Choose({ recent, onChoose, onGet }: { recent: WalletKind | null; onChoose: (kind: WalletKind) => void; onGet: () => void }) {
  const { color } = useTheme();
  const apps = WALLET_CHOICES.filter((choice) => choice.kind !== "practice");
  return (
    <View style={styles.wrap}>
      <View style={styles.strip}>
        {apps.map((choice, index) => (
          <Animated.View key={choice.kind} entering={FadeInDown.delay(70 * index).springify().damping(18)} style={styles.tileWrap}>
            <Pressable
              onPress={() => {
                haptic.tap();
                onChoose(choice.kind);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Connect with ${choice.name}`}
              accessibilityHint={choice.line}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <View style={[styles.art, { borderColor: color.hairline, backgroundColor: color.surface1 }]}>
                {choice.logo ? (
                  <Logo brand={choice.logo} size={60} radius={RADIUS.lg} />
                ) : (
                  <SymbolView name={{ ios: "iphone", android: "phone_android" }} size={28} tintColor={color.accent} />
                )}
              </View>
              <Text style={[TYPE.bodyStrong, styles.tileName, { color: color.ink }]} numberOfLines={1}>
                {choice.name}
              </Text>
              {recent === choice.kind ? <Text style={[styles.recent, { color: color.accent }]}>{T.recent}</Text> : null}
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(70 * apps.length).springify().damping(18)}>
        <Pressable
          onPress={() => {
            haptic.tap();
            onChoose("practice");
          }}
          accessibilityRole="button"
          accessibilityLabel="Use a practice wallet"
          style={({ pressed }) => [styles.practice, { backgroundColor: pressed ? color.surface2 : color.surface1, borderColor: color.hairline }]}
        >
          <View style={[styles.practiceMark, { backgroundColor: color.ground, borderColor: color.hairline }]}>
            <AgariMark width={20} height={20} />
          </View>
          <View style={styles.practiceCopy}>
            <Text style={[TYPE.bodyStrong, { color: color.ink }]}>
              No wallet app? Use a practice wallet{recent === "practice" ? <Text style={[styles.recent, { color: color.accent }]}>  {T.recent}</Text> : null}
            </Text>
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>A devnet-only key kept on this phone. Test funds, no real value.</Text>
          </View>
          <SymbolView name={{ ios: "arrow.right", android: "arrow_forward" }} size={15} tintColor={color.inkMuted} />
        </Pressable>
      </Animated.View>

      <View style={[styles.divider, { backgroundColor: color.hairline }]} />
      <View style={styles.intro}>
        <Text style={[TYPE.bodyStrong, styles.center, { color: color.ink }]}>{T.intro.title}</Text>
        <Text style={[TYPE.caption, styles.center, { color: color.inkSecondary }]}>{T.intro.description}</Text>
      </View>
      <View style={styles.row}>
        <Button label={T.intro.get} variant="secondary" onPress={onGet} style={styles.flex} />
        <Button label={T.learnMore} variant="secondary" onPress={() => void openExternal(T.learnMoreUrl)} style={styles.flex} />
      </View>
    </View>
  );
}

/** web's "Get a Wallet" step: where to download each supported wallet, with GET. */
export function GetWallet() {
  const { color } = useTheme();
  return (
    <View style={styles.wrap}>
      {GET_WALLETS.map((wallet) => (
        <View key={wallet.name} style={[styles.getRow, { borderBottomColor: color.hairline }]}>
          <Logo brand={wallet.logo} size={48} radius={RADIUS.md} />
          <Text style={[TYPE.bodyStrong, styles.flex, { color: color.ink }]}>{wallet.name}</Text>
          <Button label={T.get.action} size="sm" variant="secondary" block={false} onPress={() => void openExternal(wallet.url)} />
        </View>
      ))}
      <View style={styles.intro}>
        <Text style={[TYPE.bodyStrong, styles.center, { color: color.ink }]}>{T.get.lookingTitle}</Text>
        <Text style={[TYPE.caption, styles.center, { color: color.inkSecondary }]}>{T.get.lookingBody}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  strip: { flexDirection: "row", justifyContent: "center", gap: 8 },
  tileWrap: { flex: 1, maxWidth: 110 },
  tile: { alignItems: "center", gap: 6, paddingVertical: 8, borderRadius: RADIUS.lg },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  art: { width: 64, height: 64, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tileName: { fontSize: 13.5 },
  recent: { fontFamily: FONT.bodyStrong, fontSize: 11 },
  practice: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  practiceMark: { width: 40, height: 40, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  practiceCopy: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth },
  intro: { gap: 6, paddingHorizontal: 8 },
  center: { textAlign: "center" },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  getRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
