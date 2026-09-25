import { FAUCET_UNITS, SOL_FAUCETS } from "@agari/core/constants";
import { collateralOrNull } from "@agari/markets";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { FUNDING } from "@/features/funding/copy";
import { useFaucet } from "@/features/markets/faucet/useFaucet";
import { CONNECT, diagnosisCopy } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { CreditWelcome } from "~/components/funding/CreditWelcome";
import { FootLine, FootText, FundingFacts, fundStyles } from "~/components/funding/FundingFacts";
import { BottomDrawer, type DrawerClose } from "~/components/drawer/BottomDrawer";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { WebButton } from "~/components/portfolio/web";
import { dismiss } from "~/components/wallet/WalletSheet";
import { openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { walletTokens } from "~/theme/web/portfolio-wallet";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

/**
 * web `AddFunds` in the app's bottom drawer (the owner's call, 09-25: Add funds rises from the bottom on a phone) — web's
 * card paper, border, 28 of padding and gray-600 X, over the blurred scrim — the glowing eyebrow, "Get test
 * funds", the fee paragraph, the account row that copies, `FundingProgress`, the white mint pill (then "Trade from
 * wallet →"), and the SOL faucet foot. One free signature covers the SOL top-up and the tUSDC mint (D-034).
 */
export default function FundsModal() {
  const { color, name } = useTheme();
  const t = walletTokens(name);
  const session = useWalletSession();
  const { address } = session;
  const faucet = useFaucet();
  const [copied, setCopied] = useState(false);
  const symbol = collateralOrNull()?.symbol ?? "tUSDC";
  const amountText = String(FAUCET_UNITS);
  const done = faucet.state.phase === "confirmed";
  const diagnosis = faucet.state.diagnosis;
  const minting = faucet.busy;
  const connecting = session.isConnecting || session.connecting;
  const drawer = useRef<DrawerClose | null>(null);
  const close = (after?: () => void) => (drawer.current ? drawer.current(after) : (dismiss(), after?.()));

  return (
    <View style={styles.fill}>
      <BottomDrawer
        onClose={dismiss}
        closeRef={drawer}
        closeLabel={FUNDING.modal.close}
        background={t.fundPaper}
        border={t.fundBorder}
        contentStyle={styles.sheet}
        corner={
          <Pressable onPress={() => close()} accessibilityRole="button" accessibilityLabel={FUNDING.modal.close} hitSlop={8} style={({ pressed }) => [styles.x, pressed && { backgroundColor: t.fundLine }]}>
            <X size={16} color={color.inkDisabled} />
          </Pressable>
        }
      >
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, { backgroundColor: t.vermilion, shadowColor: t.vermilion }]} />
          <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{FUNDING.modal.eyebrow}</Text>
        </View>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {FUNDING.modal.title}
        </Text>
        <Text style={[styles.body, { color: color.inkSecondary }]}>{FUNDING.modal.body}</Text>

        {!address ? (
          <View style={styles.connectFirst}>
            <Text style={[styles.connectLine, { color: color.inkMuted }]}>{FUNDING.modal.connectFirst}</Text>
            <WebButton label={connecting ? CONNECT.connecting : CONNECT.connect} onPress={session.connect} disabled={connecting} style={styles.center} />
          </View>
        ) : (
          <>
            <View style={[styles.account, { borderColor: t.fundLine }]}>
              <Text style={[styles.accountLabel, { color: color.inkMuted }]}>{FUNDING.modal.account}</Text>
              <Pressable
                onPress={() => {
                  void Clipboard.setStringAsync(address);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                accessibilityRole="button"
                accessibilityLabel="Copy account address"
                hitSlop={8}
              >
                {({ pressed }) => <Text style={[styles.addr, { color: pressed ? color.ink : t.addrInk }]}>{copied ? FUNDING.modal.copied : `${short(address)} ⧉`}</Text>}
              </Pressable>
            </View>

            <FundingFacts address={address} faucet={faucet} />

            {done ? (
              <Pressable
                onPress={() => close(() => router.navigate("/markets"))}
                accessibilityRole="link"
                style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? color.accentPressed : t.vermilion }]}
              >
                <Text style={[styles.pillText, { color: t.vermilionInk }]}>{FUNDING.modal.trade}</Text>
              </Pressable>
            ) : (
              <View style={styles.rows}>
                <FootLine text={FUNDING.modal.sequence(FAUCET_UNITS.toLocaleString("en-US"), symbol)} />
                <Pressable
                  onPress={() => void faucet.mint()}
                  disabled={minting || !faucet.hasSigner}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: minting || !faucet.hasSigner, busy: minting }}
                  style={({ pressed }) => [
                    styles.pill,
                    styles.pillRow,
                    { backgroundColor: t.ctaWhite, opacity: minting || !faucet.hasSigner ? 0.6 : 1 },
                    pressed && styles.pressed,
                  ]}
                >
                  <TUsdcMark size={16} />
                  <Text style={[styles.pillText, { color: t.ctaWhiteInk }]}>{minting ? faucet.label : FUNDING.modal.request(amountText, symbol)}</Text>
                </Pressable>
              </View>
            )}

            {done ? <Text style={[fundStyles.msg, { color: color.profit }]}>{FUNDING.modal.done(amountText, symbol)}</Text> : null}
            {done ? (
              <View style={styles.more}>
                <FootText label="Get more test funds" onPress={faucet.resetCompleted} />
              </View>
            ) : null}
            {diagnosis && !done ? <Text style={[fundStyles.msg, { color: color.loss }]}>{diagnosisCopy(diagnosis.kind).headline}</Text> : null}

            <View style={[styles.foot, { borderTopColor: t.fundLine }]}>
              {faucet.state.gasShort ? <FootLine text={FUNDING.modal.gasFirst} /> : null}
              {SOL_FAUCETS.slice(0, faucet.state.gasShort ? SOL_FAUCETS.length : 1).map((f) => (
                <FootText key={f.url} label={faucet.state.gasShort ? `${f.name} ↗` : FUNDING.modal.needMore} onPress={() => void openExternal(f.url)} />
              ))}
            </View>
          </>
        )}
      </BottomDrawer>
      <CreditWelcome local />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 28 },
  x: { borderRadius: 999, padding: 8 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 999, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 28.8, letterSpacing: -0.6, marginBottom: 4, paddingRight: 24 },
  body: { fontFamily: FONT.body, fontSize: 14, lineHeight: 22.75, marginBottom: 24 },
  connectFirst: { alignItems: "center", gap: 16, paddingVertical: 24 },
  connectLine: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, textAlign: "center" },
  center: { alignSelf: "center" },
  account: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  accountLabel: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  addr: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  rows: { gap: 10 },
  pill: { alignSelf: "stretch", borderRadius: 999, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  pillRow: { flexDirection: "row", gap: 8 },
  pillText: { fontFamily: FONT.bodyStrong, fontSize: 15, lineHeight: 24 },
  pressed: { transform: [{ scale: 0.97 }] },
  more: { alignItems: "flex-start" },
  foot: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, alignItems: "center", gap: 6 },
});
