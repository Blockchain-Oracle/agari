import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { haptic } from "~/components/kit";
import { BackButton, CloseButton } from "~/components/wallet/sheet-parts";
import { dismiss, WalletSheet } from "~/components/wallet/WalletSheet";
import { Choose, GetWallet } from "~/features/connect/Choose";
import { Handoff } from "~/features/connect/Handoff";
import { openExternal } from "~/lib/external";
import { storage } from "~/lib/storage";
import { FONT, useTheme } from "~/theme";
import { WALLET_CHOICES, type WalletKind } from "~/wallet/choices";
import { cancelWalletRequest } from "~/wallet/link-port";
import { useConnectWallet, WalletNotInstalledError } from "~/wallet/WalletProvider";

const RECENT_KEY = "agari.wallet.recent";

type Phase =
  | { kind: "connect"; connecting: WalletKind | null }
  | { kind: "get" }
  | { kind: "detail"; wallet: WalletKind; error: string | null; missingUrl: string | null };

const choiceOf = (kind: WalletKind) => WALLET_CHOICES.find((c) => c.kind === kind) ?? WALLET_CHOICES[0]!;

/**
 * web's connect modal as it draws at 402 px: RainbowKit's bottom sheet holding `WalletPickerPhone`. A wallet tile
 * rings with the spinner while its app has the turn; a connect closes the sheet, as web's does. A refusal or a
 * missing app lands on web's `ConnectStep` (RETRY / INSTALL), with Back to the strip.
 */
export default function ConnectSheet() {
  const { color } = useTheme();
  const connect = useConnectWallet();
  const [phase, setPhase] = useState<Phase>({ kind: "connect", connecting: null });
  const attempt = useRef(0);
  const recent = (storage.getString(RECENT_KEY) as WalletKind | undefined) ?? null;

  const choose = async (kind: WalletKind) => {
    const id = ++attempt.current;
    setPhase({ kind: "connect", connecting: kind });
    try {
      await connect(kind);
      if (attempt.current !== id) return;
      storage.set(RECENT_KEY, kind);
      haptic.success();
      dismiss();
    } catch (error) {
      if (attempt.current !== id) return;
      haptic.error();
      if (error instanceof WalletNotInstalledError) setPhase({ kind: "detail", wallet: kind, error: null, missingUrl: error.storeUrl });
      else setPhase({ kind: "detail", wallet: kind, error: error instanceof Error ? error.message : String(error), missingUrl: null });
    }
  };

  const close = () => {
    attempt.current += 1;
    cancelWalletRequest();
    dismiss();
  };
  const toStrip = () => {
    attempt.current += 1;
    cancelWalletRequest();
    setPhase({ kind: "connect", connecting: null });
  };

  const title = phase.kind === "get" ? WALLET_MODAL.get.title : WALLET_MODAL.title;
  return (
    <WalletSheet onClose={close}>
      <View style={styles.mobile}>
        <View style={[styles.head, { backgroundColor: color.surface1 }]}>
          <View style={styles.headRow}>
            {phase.kind !== "connect" ? (
              <View style={styles.back}>
                <BackButton onPress={toStrip} />
              </View>
            ) : null}
            <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
              {title}
            </Text>
            <View style={styles.close}>
              <CloseButton onPress={close} />
            </View>
          </View>
        </View>
        {phase.kind === "connect" ? <Choose recent={recent} connecting={phase.connecting} onChoose={(kind) => void choose(kind)} onGet={() => setPhase({ kind: "get" })} /> : null}
        {phase.kind === "get" ? <GetWallet /> : null}
        {phase.kind === "detail" ? (
          <Handoff
            choice={choiceOf(phase.wallet)}
            failed={phase.error !== null}
            error={phase.error}
            missingUrl={phase.missingUrl}
            onRetry={() => void choose(phase.wallet)}
            onInstall={() => (phase.missingUrl ? void openExternal(phase.missingUrl) : undefined)}
          />
        ) : null}
      </View>
    </WalletSheet>
  );
}

const styles = StyleSheet.create({
  // .wm-mobile: padding-bottom 36 + the safe area (the sheet adds the inset)
  mobile: { paddingBottom: 36 },
  head: { paddingTop: 14, paddingBottom: 4 },
  headRow: { justifyContent: "center", paddingHorizontal: 20, paddingBottom: 6 },
  back: { position: "absolute", left: 0, top: 0, zIndex: 1 },
  title: { width: "100%", marginTop: 4, textAlign: "center", fontFamily: FONT.bodyBold, fontSize: 20, lineHeight: 24 },
  close: { position: "absolute", right: 14, top: 0, height: 32, justifyContent: "center" },
});
