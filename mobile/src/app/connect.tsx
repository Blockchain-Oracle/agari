import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { openExternal } from "~/lib/external";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { WalletRow } from "~/components/wallet/WalletRow";
import { SPACE, TYPE, useTheme } from "~/theme";
import { WALLET_CHOICES, type WalletKind } from "~/wallet/choices";
import { useConnectWallet, WalletNotInstalledError } from "~/wallet/WalletProvider";
import * as Linking from "expo-linking";

/** web's connect modal as a native sheet: every wallet this phone can reach, in web's words. */
export default function ConnectSheet() {
  const { color } = useTheme();
  const connect = useConnectWallet();
  const [busy, setBusy] = useState<WalletKind | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ name: string; url: string } | null>(null);

  const choose = async (kind: WalletKind) => {
    setBusy(kind);
    setFailure(null);
    setMissing(null);
    try {
      await connect(kind);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const name = WALLET_CHOICES.find((c) => c.kind === kind)?.name ?? kind;
      if (error instanceof WalletNotInstalledError) setMissing({ name, url: error.storeUrl });
      else setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const opening = busy && busy !== "practice" ? WALLET_CHOICES.find((c) => c.kind === busy)?.name : null;
  return (
    <ScrollView contentContainerStyle={styles.body} style={{ backgroundColor: color.ground }}>
      <Text style={[TYPE.title, styles.center, { color: color.ink }]}>{WALLET_MODAL.title}</Text>
      <View style={styles.list}>
        {WALLET_CHOICES.map((choice, index) => (
          <WalletRow key={choice.kind} choice={choice} index={index} busy={busy === choice.kind} onPress={() => choose(choice.kind)} />
        ))}
      </View>
      {opening ? <Text style={[TYPE.caption, styles.center, { color: color.inkSecondary }]}>{WALLET_MODAL.status.opening(opening)}</Text> : null}
      {missing ? (
        <View style={styles.missing}>
          <Text style={[TYPE.body, { color: color.ink }]}>{WALLET_MODAL.status.notInstalled(missing.name)}</Text>
          <Pressable onPress={() => Linking.openURL(missing.url)} accessibilityRole="link" style={[styles.install, { backgroundColor: color.accent }]}>
            <Text style={[TYPE.labelMicro, { color: color.onAccent }]}>{WALLET_MODAL.status.install}</Text>
          </Pressable>
        </View>
      ) : null}
      {failure ? <Text style={[TYPE.caption, styles.center, { color: color.loss }]}>{failure}</Text> : null}
      <View style={[styles.foot, { borderTopColor: color.hairline }]}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{WALLET_MODAL.newTo}</Text>
        <Pressable onPress={() => openExternal(WALLET_MODAL.learnMoreUrl)} accessibilityRole="link" hitSlop={8}>
          <Text style={[TYPE.bodyStrong, { color: color.accent }]}>{WALLET_MODAL.learnMore}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 22, gap: 16 },
  center: { textAlign: "center" },
  list: { gap: 8 },
  missing: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  install: { paddingHorizontal: 14, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  foot: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
