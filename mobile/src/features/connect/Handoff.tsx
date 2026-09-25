import { StyleSheet, Text, View } from "react-native";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { ActionButton, Spinner } from "~/components/wallet/sheet-parts";
import { FONT, useTheme } from "~/theme";
import type { WalletChoice } from "~/wallet/choices";
import { ChoiceArt } from "./Choose";

const T = WALLET_MODAL;

/**
 * web `ConnectStep` (RainbowKit's `ConnectDetail`): the wallet's 44 pt icon, "Opening X..." with the confirm line and
 * a spinner, RETRY once it failed (the wallet's own reason in place of the confirm line); "X is not installed" with
 * INSTALL for a wallet app this phone does not have. Shown when a hand-off to the wallet app did not come back connected.
 */
export function Handoff({ choice, failed, error, missingUrl, onRetry, onInstall }: {
  choice: WalletChoice;
  failed: boolean;
  error: string | null;
  missingUrl: string | null;
  onRetry: () => void;
  onInstall: () => void;
}) {
  const { color } = useTheme();
  const installed = missingUrl === null;
  return (
    <View style={styles.detail} accessibilityLiveRegion="polite">
      <View style={styles.main}>
        <View style={styles.stack}>
          <ChoiceArt choice={choice} size={44} />
          <View style={styles.text}>
            <Text style={[styles.title, { color: color.ink }]}>{installed ? T.status.opening(choice.name) : T.status.notInstalled(choice.name)}</Text>
            {installed ? (
              <>
                <Text style={[styles.t14m, { color: color.inkSecondary }]}>{failed && error ? error : T.status.confirm}</Text>
                <View style={styles.status}>{failed ? <ActionButton label={T.status.retry} onPress={onRetry} /> : <Spinner />}</View>
              </>
            ) : (
              <View style={styles.install}>
                <ActionButton secondary label={T.status.install} onPress={onInstall} />
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.foot} />
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { minHeight: 396, paddingHorizontal: 16 },
  main: { flex: 1, alignItems: "center", justifyContent: "center" },
  stack: { alignItems: "center", gap: 8 },
  text: { alignItems: "center", gap: 4, paddingHorizontal: 32 },
  title: { fontFamily: FONT.bodyBold, fontSize: 18, lineHeight: 24, textAlign: "center" },
  t14m: { fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 18, textAlign: "center" },
  status: { flexDirection: "row", alignItems: "center", height: 32, marginTop: 8 },
  install: { paddingTop: 20 },
  foot: { height: 28, marginTop: 12 },
});
