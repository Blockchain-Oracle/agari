import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, haptic } from "~/components/kit";
import { Logo } from "~/components/logos/Logo";
import { Choose, GetWallet } from "~/features/connect/Choose";
import { Connected } from "~/features/connect/Connected";
import { Handoff } from "~/features/connect/Handoff";
import { openExternal } from "~/lib/external";
import { storage } from "~/lib/storage";
import { SPACE, TYPE, useTheme } from "~/theme";
import { WALLET_CHOICES, type WalletKind } from "~/wallet/choices";
import { cancelWalletRequest } from "~/wallet/link-port";
import { useConnectWallet, WalletNotInstalledError } from "~/wallet/WalletProvider";

const RECENT_KEY = "agari.wallet.recent";

type Phase =
  | { kind: "choose" }
  | { kind: "get" }
  | { kind: "handoff"; wallet: WalletKind; stage: "opening" | "waiting" | "failed"; error: string | null }
  | { kind: "missing"; wallet: WalletKind; storeUrl: string }
  | { kind: "connected"; wallet: WalletKind };

const nameOf = (kind: WalletKind) => WALLET_CHOICES.find((c) => c.kind === kind)?.name ?? kind;
const logoOf = (kind: WalletKind) => WALLET_CHOICES.find((c) => c.kind === kind)?.logo ?? null;

/**
 * Connecting a wallet on a phone, as its own small journey: pick a wallet app (or the practice key), go to that app
 * and come back, land on the account with a next step. Every wait says what is happening and has a way out.
 */
export default function ConnectSheet() {
  const { color } = useTheme();
  const connect = useConnectWallet();
  const session = useWalletSession();
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const attempt = useRef(0);
  const recent = (storage.getString(RECENT_KEY) as WalletKind | undefined) ?? null;

  const choose = async (kind: WalletKind) => {
    const id = ++attempt.current;
    const handsOff = kind === "phantom" || kind === "solflare" || kind === "mwa";
    if (handsOff) setPhase({ kind: "handoff", wallet: kind, stage: "opening", error: null });
    // Once the wallet app is in front, the wait is the person's approval, not the app opening.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && attempt.current === id) setPhase((p) => (p.kind === "handoff" ? { ...p, stage: "waiting" } : p));
    });
    try {
      await connect(kind);
      if (attempt.current !== id) return;
      storage.set(RECENT_KEY, kind);
      haptic.success();
      setPhase({ kind: "connected", wallet: kind });
    } catch (error) {
      if (attempt.current !== id) return;
      haptic.error();
      if (error instanceof WalletNotInstalledError) setPhase({ kind: "missing", wallet: kind, storeUrl: error.storeUrl });
      else setPhase({ kind: "handoff", wallet: kind, stage: "failed", error: error instanceof Error ? error.message : String(error) });
    } finally {
      sub.remove();
    }
  };

  const cancel = () => {
    attempt.current += 1;
    cancelWalletRequest();
    setPhase({ kind: "choose" });
  };

  const title = phase.kind === "get" ? WALLET_MODAL.get.title : phase.kind === "connected" ? "" : WALLET_MODAL.title;
  return (
    <>
      <Stack.Screen options={{ title: title || "Connected" }} />
      <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          {phase.kind === "get" ? (
            <Pressable onPress={() => setPhase({ kind: "choose" })} accessibilityRole="button" accessibilityLabel={WALLET_MODAL.back} hitSlop={12}>
              <Text style={[TYPE.bodyStrong, { color: color.accent }]}>‹ {WALLET_MODAL.back}</Text>
            </Pressable>
          ) : (
            <View />
          )}
        </View>
        {title ? <Text style={[TYPE.title, styles.center, { color: color.ink }]} accessibilityRole="header">{title}</Text> : null}

        {phase.kind === "choose" ? <Choose recent={recent} onChoose={(kind) => void choose(kind)} onGet={() => setPhase({ kind: "get" })} /> : null}
        {phase.kind === "get" ? <GetWallet /> : null}
        {phase.kind === "handoff" ? (
          <Handoff name={nameOf(phase.wallet)} logo={logoOf(phase.wallet)} stage={phase.stage} error={phase.error} onCancel={cancel} onRetry={() => void choose(phase.wallet)} />
        ) : null}
        {phase.kind === "missing" ? (
          <View style={styles.missing}>
            {logoOf(phase.wallet) ? <Logo brand={logoOf(phase.wallet)!} size={64} radius={16} /> : null}
            <Text style={[TYPE.title, styles.center, { color: color.ink }]}>{WALLET_MODAL.status.notInstalled(nameOf(phase.wallet))}</Text>
            <Text style={[TYPE.body, styles.center, { color: color.inkSecondary }]}>
              Install it, set it to Solana devnet, then come back and choose it again. Or use the practice wallet now.
            </Text>
            <Button label={`Get ${nameOf(phase.wallet)}`} onPress={() => void openExternal(phase.storeUrl)} />
            <Button label="Use the practice wallet" variant="secondary" onPress={() => void choose("practice")} />
            <Button label={WALLET_MODAL.back} variant="ghost" onPress={() => setPhase({ kind: "choose" })} />
          </View>
        ) : null}
        {phase.kind === "connected" && session.address ? (
          <Connected
            address={session.address}
            walletName={nameOf(phase.wallet)}
            onFunds={() => {
              router.back();
              router.push("/funds");
            }}
            onDone={() => router.back()}
          />
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 14, paddingBottom: 40, gap: 16 },
  head: { minHeight: 22, flexDirection: "row" },
  center: { textAlign: "center" },
  missing: { alignItems: "center", gap: 12, alignSelf: "stretch" },
});
