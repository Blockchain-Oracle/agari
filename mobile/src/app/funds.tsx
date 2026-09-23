import { FAUCET_UNITS, SOL_FAUCETS } from "@agari/core/constants";
import { collateralOrNull } from "@agari/markets";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FUNDING } from "@/features/funding/copy";
import { useFaucet } from "@/features/markets/faucet/useFaucet";
import { diagnosisCopy } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { FundingFacts } from "~/components/funding/FundingFacts";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

/** web's AddFunds as a sheet: SOL for fees if needed, then free tUSDC, behind one free signature (D-034). */
export default function FundsSheet() {
  const { color } = useTheme();
  const { address, connect } = useWalletSession();
  const faucet = useFaucet();
  const [copied, setCopied] = useState(false);
  const symbol = collateralOrNull()?.symbol ?? "tUSDC";
  const amountText = String(FAUCET_UNITS);
  const done = faucet.state.phase === "confirmed";
  const diagnosis = faucet.state.diagnosis;

  return (
    <ScrollView style={{ backgroundColor: color.ground }} contentContainerStyle={styles.body}>
      <View style={styles.eyebrow}>
        <View style={[styles.dot, { backgroundColor: color.accent }]} />
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{FUNDING.modal.eyebrow}</Text>
      </View>
      <Text style={[TYPE.headline, { color: color.ink }]}>{FUNDING.modal.title}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{FUNDING.modal.body}</Text>

      {!address ? (
        <View style={styles.gap}>
          <Text style={[TYPE.body, { color: color.ink }]}>{FUNDING.modal.connectFirst}</Text>
          <Cta tone="accent" label="Connect" onPress={connect} />
        </View>
      ) : (
        <>
          <View style={styles.account}>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{FUNDING.modal.account}</Text>
            <Pressable onPress={() => { Clipboard.setStringAsync(address); Haptics.selectionAsync(); setCopied(true); setTimeout(() => setCopied(false), 1500); }} accessibilityLabel="Copy account address">
              <Text style={[TYPE.data, { color: color.ink }]}>{copied ? FUNDING.modal.copied : `${short(address)} ⧉`}</Text>
            </Pressable>
          </View>
          <FundingFacts address={address} faucet={faucet} />
          {done ? (
            <Cta tone="accent" label={FUNDING.modal.trade} onPress={() => { router.back(); router.navigate("/markets"); }} />
          ) : (
            <View style={styles.gap}>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>{FUNDING.modal.sequence(FAUCET_UNITS.toLocaleString("en-US"), symbol)}</Text>
              <Cta tone="paper" mark label={faucet.busy ? faucet.label : FUNDING.modal.request(amountText, symbol)} disabled={faucet.busy || !faucet.hasSigner} onPress={() => void faucet.mint()} />
            </View>
          )}
          {done ? <Text style={[TYPE.bodyStrong, { color: color.profit }]}>{FUNDING.modal.done(amountText, symbol)}</Text> : null}
          {done ? <Link label="Get more test funds" onPress={faucet.resetCompleted} /> : null}
          {diagnosis && !done ? <Text style={[TYPE.body, { color: color.loss }]}>{diagnosisCopy(diagnosis.kind).headline}</Text> : null}
          <View style={styles.gap}>
            {faucet.state.gasShort ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{FUNDING.modal.gasFirst}</Text> : null}
            {SOL_FAUCETS.slice(0, faucet.state.gasShort ? SOL_FAUCETS.length : 1).map((f) => (
              <Link key={f.url} label={faucet.state.gasShort ? `${f.name} ↗` : FUNDING.modal.needMore} onPress={() => WebBrowser.openBrowserAsync(f.url)} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Cta({ label, onPress, tone, disabled, mark }: { label: string; onPress: () => void; tone: "accent" | "paper"; disabled?: boolean; mark?: boolean }) {
  const { color } = useTheme();
  const bg = tone === "accent" ? color.accent : color.cream;
  const ink = tone === "accent" ? color.onAccent : color.creamInk;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.cta, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
      {mark ? <TUsdcMark size={20} /> : null}
      <Text style={[styles.ctaText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6}>
      <Text style={[TYPE.caption, { color: color.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 24, gap: 14, paddingBottom: 48 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  gap: { gap: 8 },
  account: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cta: { height: 52, borderRadius: RADIUS.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaText: { fontFamily: FONT.bodyStrong, fontSize: 16 },
});
