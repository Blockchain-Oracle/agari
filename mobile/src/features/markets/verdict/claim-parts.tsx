import { shortHex } from "@agari/core/units";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Check, Loader2 } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { VERDICT_UI } from "@/lib/copy";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { wordsTokens } from "~/theme/web/markets-words";

type Tone = "win" | "void";

function useTokens() {
  const { name, color } = useTheme();
  return { color, t: wordsTokens(name) };
}

/** `.cw-win`'s top-down profit wash and its blurred glow (a 288 × 160 ellipse under a 64 px blur, drawn as a soft radial). */
export function WinGlow() {
  const { t } = useTokens();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[t.cwWinTop, t.cwWinMid, t.cwWinClear]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Svg style={styles.glow} width={416} height={288}>
        <Defs>
          <RadialGradient id="cw-glow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" {...stopPaint(t.cwGlow, 1)} />
            <Stop offset="0.45" {...stopPaint(t.cwGlow, 0.8)} />
            <Stop offset="1" {...stopPaint(t.cwGlow, 0)} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={208} cy={144} rx={208} ry={144} fill="url(#cw-glow)" />
      </Svg>
    </View>
  );
}

/** `.cw-win-flow`: "Stake 5.00 → Payout 9.60" in 11 pt mono, the figures a step brighter. */
export function Flow({ stake, to, toLabel }: { stake: string; to: string; toLabel: string }) {
  const { color, t } = useTokens();
  return (
    <View style={styles.flow}>
      <Text style={[styles.flowText, { color: color.inkSecondary }]}>
        {VERDICT_UI.claim.stake} <Text style={{ color: t.gray200 }}>{stake}</Text>
      </Text>
      <ArrowRight size={12} color={color.inkDisabled} />
      <Text style={[styles.flowText, { color: color.inkSecondary }]}>
        {toLabel} <Text style={{ color: t.gray200 }}>{to}</Text>
      </Text>
    </View>
  );
}

/** `.cw-paid` (or the void's gray `.cw-void-paid`), then the payout transaction under it when there is one. */
export function Paid({ tone, byCrank, txHash }: { tone: Tone; byCrank: boolean; txHash: string | null }) {
  const { color, t } = useTokens();
  const win = tone === "win";
  const ink = win ? color.profit : t.gray300;
  return (
    <>
      <View style={[styles.paid, { backgroundColor: win ? t.cwPaidFill : t.cwVoidPaidFill, borderColor: win ? t.cwPaidBorder : t.cwVoidPaidBorder }]}>
        <Check size={16} color={ink} />
        <Text style={[styles.paidText, { color: ink }]}>{byCrank ? VERDICT_UI.claim.paidAuto : VERDICT_UI.claim.paid}</Text>
      </View>
      {txHash ? (
        <Text style={[styles.foot, { color: color.inkMuted }]}>
          {VERDICT_UI.claim.paidTx}{" "}
          <Text onPress={() => void openExternal(explorerUrl("tx", txHash))} accessibilityRole="link" style={[styles.hash, { color: color.inkSecondary }]}>
            {shortHex(txHash, 6, 4)}
          </Text>
        </Text>
      ) : null}
    </>
  );
}

/** `.cw-collect`: the profit-green button (the void's gray one), with web's spinning loader while it collects. */
export function Collect({ tone, claiming, disabled, onPress }: { tone: Tone; claiming: boolean; disabled: boolean; onPress: () => void }) {
  const { color, t } = useTokens();
  const win = tone === "win";
  const ink = win ? t.cwCollectInk : t.cwVoidCollectInk;
  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: claiming }}
        style={({ pressed }) => [
          styles.collect,
          win ? [styles.collectGlow, { shadowColor: t.cwCollectGlow }] : null,
          { backgroundColor: win ? color.profit : t.gray200, opacity: disabled ? 0.6 : pressed ? 0.92 : 1 },
        ]}
      >
        {claiming ? <Spinner color={ink} /> : null}
        <Text style={[styles.collectText, { color: ink }]}>{claiming ? VERDICT_UI.claim.collecting : VERDICT_UI.claim.collect}</Text>
      </Pressable>
      <Text style={[styles.foot, { color: color.inkMuted }]}>{win ? VERDICT_UI.claim.foot : VERDICT_UI.claim.voidFoot}</Text>
    </>
  );
}

/** lucide Loader2 with web's `animate-spin`: one turn a second. */
function Spinner({ color }: { color: string }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Loader2 size={16} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: -144, alignSelf: "center" },
  flow: { marginTop: 12, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  flowText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, fontVariant: ["tabular-nums"] },
  paid: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 12 },
  paidText: { fontFamily: FONT.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  foot: { marginTop: 8, textAlign: "center", fontFamily: FONT.body, fontSize: 10, lineHeight: 15 },
  hash: { fontFamily: FONT.dataRegular, textDecorationLine: "underline" },
  collect: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  collectGlow: { shadowOpacity: 1, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  collectText: { fontFamily: FONT.bodyBold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, textTransform: "uppercase" },
});
