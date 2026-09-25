import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FUNDING } from "@/features/funding/copy";
import { useBalancePlate } from "@/features/markets/balance/useBalancePlate";
import { ACCOUNT_MENU, CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { FONT, useTheme } from "~/theme";
import { CHROME, chromeTokens, type ChromeTokens } from "~/theme/chrome";

const AMOUNT_DP = 2;

/**
 * web's header-right on a phone (HeaderMoneyPill + HeaderAccount): "Connect" until a wallet is connected; then the
 * balance pill (total, unit, vermilion +, opens Add money) and the address button — under 420 px web shows only
 * its avatar dot — whose menu is exactly two balance rows, Portfolio and Disconnect.
 */
export function HeaderAccount() {
  const session = useWalletSession();
  const { name, color } = useTheme();
  const t = chromeTokens(name);
  const [open, setOpen] = useState(false);

  if (!session.isConnected || !session.address) {
    return (
      <Pressable onPress={session.connect} accessibilityRole="button" style={({ pressed }) => [styles.connect, { backgroundColor: pressed ? color.accentPressed : color.accent }]}>
        <Text style={[styles.connectText, { color: t.connectInk }]}>{CONNECT.connect}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.row}>
      <MoneyPill t={t} />
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={ACCOUNT_MENU.open} style={[styles.wallet, { borderColor: t.pillBorder }]}>
        <AddrDot t={t} accent={color.accent} />
      </Pressable>
      <AccountMenu open={open} onClose={() => setOpen(false)} t={t} disconnect={session.disconnect} />
    </View>
  );
}

function AddrDot({ t, accent }: { t: ChromeTokens; accent: string }) {
  return (
    <LinearGradient colors={[t.addrDotFrom, t.addrDotTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dot}>
      <View style={[styles.dotCore, { backgroundColor: accent }]} />
    </LinearGradient>
  );
}

function useSheetAmounts() {
  const balance = useBalancePlate();
  const sheet = balance.kind === "connected" && balance.reading && isOk(balance.reading) ? balance.reading.value : null;
  const fmt = (value: bigint | null | undefined) =>
    sheet && value !== null && value !== undefined ? formatBaseUnits(value, sheet.decimals, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP }) : null;
  return { balance, sheet, fmt };
}

function MoneyPill({ t }: { t: ChromeTokens }) {
  const { color } = useTheme();
  const { balance, sheet, fmt } = useSheetAmounts();
  const total = sheet ? fmt(sheet.spendableBase + (sheet.vaultBase ?? 0n)) : null;
  const label = total === null ? FUNDING.pill.aria : `Balance ${total} ${balance.symbol ?? ""}. Tap to add money.`;
  return (
    <Pressable onPress={() => router.push("/funds")} accessibilityRole="button" accessibilityLabel={label} style={[styles.money, { borderColor: t.pillBorder }]}>
      <TUsdcMark size={14} />
      <Text style={[styles.total, { color: total === null ? t.pillDim : t.pillTotal }]} numberOfLines={1}>{total ?? "—"}</Text>
      <Text style={[styles.plus, { color: color.accent }]}>{FUNDING.pill.plus}</Text>
    </Pressable>
  );
}

function AccountMenu({ open, onClose, t, disconnect }: { open: boolean; onClose: () => void; t: ChromeTokens; disconnect: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const { sheet, fmt } = useSheetAmounts();
  const top = insets.top + CHROME.marquee + CHROME.header + 8;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.menu, { top, backgroundColor: t.menuBg, borderColor: t.menuBorder }]} accessibilityRole="menu">
        <View style={[styles.pools, { borderBottomColor: t.menuPoolsBorder }]}>
          <View style={styles.menuRow}>
            <Text style={[styles.menuText, { color: t.menuRowLabel }]}>{ACCOUNT_MENU.tradingAccount}</Text>
            <Text style={[styles.menuText, { color: t.menuVal }]}>{fmt(sheet?.vaultBase) ?? "—"}</Text>
          </View>
          <View style={[styles.menuRow, { marginTop: 4 }]}>
            <Text style={[styles.menuText, { color: t.menuRowLabel }]}>{ACCOUNT_MENU.wallet}</Text>
            <Text style={[styles.menuText, { color: t.menuValSoft }]}>{fmt(sheet?.spendableBase) ?? "—"}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="menuitem" style={styles.link} onPress={() => { onClose(); router.navigate("/portfolio"); }}>
          <Text style={[styles.linkText, { color: t.menuLink }]}>{ACCOUNT_MENU.portfolio}</Text>
        </Pressable>
        <Pressable accessibilityRole="menuitem" style={styles.link} onPress={() => { onClose(); void disconnect(); }}>
          <Text style={[styles.linkText, { color: t.menuDanger }]}>{CONNECT.disconnect}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  // .btn.btn-primary at phone width: 35 tall, 11/22 padding, Inter 600 13, letter-spacing 0.26.
  connect: { height: 35, paddingHorizontal: 22, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  connectText: { fontFamily: FONT.bodyStrong, fontSize: 13, letterSpacing: 0.26 },
  // .dusdc-pill under 420 px: max 110 wide, the unit dropped.
  money: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 110, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  total: { flexShrink: 1, fontFamily: FONT.dataStrong, fontSize: 12, fontVariant: ["tabular-nums"] },
  plus: { marginLeft: 2, fontFamily: FONT.dataStrong, fontSize: 15, lineHeight: 15 },
  // .wallet-pill under 420 px: a 36 px circle holding only the addr-dot.
  wallet: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dotCore: { width: 8, height: 8, borderRadius: 4 },
  menu: { position: "absolute", right: 14, minWidth: 210, paddingVertical: 4, borderWidth: 1, borderRadius: 8 },
  pools: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  menuRow: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  menuText: { fontFamily: FONT.dataRegular, fontSize: 11, fontVariant: ["tabular-nums"] },
  link: { paddingVertical: 8, paddingHorizontal: 16 },
  linkText: { fontFamily: FONT.dataRegular, fontSize: 12 },
});
