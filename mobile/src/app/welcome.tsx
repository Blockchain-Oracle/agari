import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Line, Path } from "react-native-svg";
import { AgariMark } from "~/components/shell/AgariMark";
import { ThemeToggle } from "~/components/shell/ThemeToggle";
import { storage } from "~/lib/storage";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const STEPS = [
  {
    index: "01 / 03",
    kicker: "SOLANA STOCK MARKETS",
    title: "Own the stock.\nCall the move.",
    body: "Agari is a stock prediction exchange. Choose Up or Down on a timed price Window, including around-the-clock PreStocks names and baskets.",
  },
  {
    index: "02 / 03",
    kicker: "THE RULE IS VISIBLE",
    title: "Know the price.\nSee the proof.",
    body: "Read the opening price, source, clock, quote and maximum loss before you call. After settlement, inspect the price prints that decided the result.",
  },
  {
    index: "03 / 03",
    kicker: "START ON DEVNET",
    title: "Explore first.\nCall when ready.",
    body: "Browse every market without a wallet. To make a call, connect Phantom, Solflare or a practice wallet and get test tUSDC. Devnet funds have no real-money value.",
  },
] as const;

export default function WelcomeScreen() {
  const { color } = useTheme();
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const finish = (connect = false) => {
    storage.set("agari.mobile.onboarded.v1", true);
    void Haptics.selectionAsync();
    router.replace("/markets");
    if (connect) setTimeout(() => router.push("/connect"), 0);
  };
  const next = () => {
    void Haptics.selectionAsync();
    if (step === STEPS.length - 1) finish();
    else setStep(step + 1);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: color.ground }]}>
      <View style={styles.topbar}>
        <View style={styles.brand}><AgariMark width={18} height={22} /><Text style={[styles.brandText, { color: color.ink }]}>AGARI</Text></View>
        <View style={styles.topRight}><Text style={[styles.step, { color: color.inkMuted }]}>{current.index}</Text><ThemeToggle /></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.rule, { borderColor: color.borderStrong }]}><Text style={[styles.kicker, { color: color.inkSecondary }]}>{current.kicker}</Text></View>
        <View style={styles.hero}>
          <Text style={[styles.title, { color: color.ink }]}>{current.title}</Text>
          <View style={[styles.titleAccent, { backgroundColor: color.accent }]} />
          <Text style={[TYPE.body, styles.body, { color: color.inkSecondary }]}>{current.body}</Text>
        </View>
        {step === 0 ? <MarketPreview /> : step === 1 ? <ProofPreview /> : <ReadyPreview />}
      </ScrollView>
      <View style={[styles.actions, { borderTopColor: color.hairline, backgroundColor: color.ground }]}>
        <View style={styles.pips}>{STEPS.map((_, index) => <View key={index} style={[styles.pip, { backgroundColor: index === step ? color.accent : color.hairline, width: index === step ? 24 : 7 }]} />)}</View>
        <Pressable onPress={next} accessibilityRole="button" accessibilityLabel={step === 2 ? "Explore markets" : "Next onboarding step"} style={({ pressed }) => [styles.button, { backgroundColor: pressed ? color.accentPressed : color.accent }]}>
          <Text style={[styles.buttonText, { color: color.onAccent }]}>{step === 2 ? "Explore markets" : "Continue"}</Text><Text style={[styles.buttonArrow, { color: color.onAccent }]}>→</Text>
        </Pressable>
        {step === 2 ? <Pressable onPress={() => finish(true)} accessibilityRole="button" style={styles.secondary}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>Connect a wallet instead</Text></Pressable> : <Pressable onPress={() => finish()} accessibilityRole="button" style={styles.secondary}><Text style={[TYPE.caption, { color: color.inkMuted }]}>Skip for now</Text></Pressable>}
      </View>
    </SafeAreaView>
  );
}

function MarketPreview() {
  const { color } = useTheme();
  return <View style={[styles.preview, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
    <View style={styles.previewHead}><Text style={[styles.mono, { color: color.accent }]}>01 · WINDOW PREVIEW</Text><Text style={[styles.mono, { color: color.profit }]}>● 24/7</Text></View>
    <View style={styles.assetRow}><View style={[styles.assetDisc, { backgroundColor: color.accentWash }]}><Text style={[styles.assetDiscText, { color: color.accent }]}>AI</Text></View><View><Text style={[TYPE.title, { color: color.ink }]}>AI Labs</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>OpenAI + Anthropic · equal weight</Text></View></View>
    <View style={[styles.indexBox, { backgroundColor: color.surface2 }]}><View><Text style={[styles.mono, { color: color.inkMuted }]}>BASKET INDEX</Text><Text style={[TYPE.dataLg, { color: color.ink }]}>Price preview</Text></View><MiniChart ink={color.profit} /></View>
    <View style={styles.previewFoot}><Text style={[TYPE.caption, { color: color.inkSecondary }]}>One-hour Windows</Text><Text style={[TYPE.data, { color: color.ink }]}>UP  /  DOWN</Text></View>
  </View>;
}

function ProofPreview() {
  const { color } = useTheme();
  return <View style={[styles.preview, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
    <View style={styles.previewHead}><Text style={[styles.mono, { color: color.accent }]}>02 · SETTLEMENT PROOF</Text><Text style={[styles.mono, { color: color.inkMuted }]}>EXAMPLE ↗</Text></View>
    <Text style={[TYPE.title, { color: color.ink }]}>A Window has an answer.</Text>
    <Text style={[TYPE.caption, { color: color.inkSecondary }]}>Opening and closing prints, source, result and transaction.</Text>
    {["OpenAI · 1h", "AI Labs · 1h"].map((name, index) => <View key={name} style={[styles.proofRow, { borderTopColor: color.hairline }]}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{name}</Text><Text style={[TYPE.caption, { color: index === 1 ? color.loss : color.profit }]}>{index === 1 ? "DOWN WON" : "UP WON"}</Text></View>)}
  </View>;
}

function ReadyPreview() {
  const { color } = useTheme();
  return <View style={[styles.preview, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
    <View style={styles.previewHead}><Text style={[styles.mono, { color: color.accent }]}>03 · YOUR FIRST CALL</Text><Text style={[styles.mono, { color: color.inkMuted }]}>DEVNET</Text></View>
    {["Browse live Windows", "Connect a Solana wallet", "Get test tUSDC & make a call"].map((line, index) => <View key={line} style={[styles.readyRow, { borderTopColor: color.hairline }]}><Text style={[styles.mono, { color: color.accent }]}>{String(index + 1).padStart(2, "0")}</Text><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{line}</Text></View>)}
  </View>;
}

function MiniChart({ ink }: { ink: string }) {
  return <Svg width={92} height={44} viewBox="0 0 92 44" accessible={false}><Line x1="0" y1="38" x2="92" y2="38" stroke={ink} strokeOpacity={0.25} /><Path d="M1 34 L12 27 L22 32 L31 12 L42 26 L51 20 L59 23 L69 16 L77 21 L91 8" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, topbar: { height: 62, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 }, brandText: { fontFamily: FONT.headingHeavy, fontSize: 16, letterSpacing: 2 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 14 }, step: { fontFamily: FONT.data, fontSize: 11 },
  content: { paddingHorizontal: 24, paddingBottom: 12, flexGrow: 1 }, rule: { borderTopWidth: 1, paddingTop: 18, marginTop: 12 },
  kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 3 }, hero: { marginTop: 22 },
  title: { fontFamily: "Georgia", fontWeight: "700", fontSize: 44, lineHeight: 46, letterSpacing: -2.4 },
  titleAccent: { width: 58, height: 3, marginTop: 22 }, body: { marginTop: 15, maxWidth: 355 },
  preview: { borderRadius: RADIUS.lg, borderWidth: 1, padding: 17, marginTop: 24, gap: 11 },
  previewHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, mono: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.1 },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 12 }, assetDisc: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, assetDiscText: { fontFamily: FONT.headingHeavy, fontSize: 15 },
  indexBox: { borderRadius: RADIUS.md, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewFoot: { flexDirection: "row", justifyContent: "space-between" },
  proofRow: { borderTopWidth: 1, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  readyRow: { borderTopWidth: 1, paddingTop: 13, flexDirection: "row", alignItems: "center", gap: 14 },
  actions: { borderTopWidth: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }, pips: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 16 }, pip: { height: 7, borderRadius: 4 },
  button: { borderRadius: RADIUS.lg, height: 54, paddingHorizontal: 19, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  buttonText: { fontFamily: FONT.bodyStrong, fontSize: 16 }, buttonArrow: { fontFamily: FONT.body, fontSize: 24 }, secondary: { minHeight: 44, justifyContent: "center", alignItems: "center" },
});
