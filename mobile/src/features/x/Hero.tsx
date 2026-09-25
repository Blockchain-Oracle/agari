import { Animated, StyleSheet, Text, View } from "react-native";
import { TRADE_FROM_X, X_HANDLE } from "@/features/x/copy";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";
import { CustodyRail } from "./CustodyRail";
import { Boot, E_DRAW, E_OUT, useOnce } from "./motion";
import { Dot } from "./StepSpine";

/**
 * web's TradeFromXScreen `.xt-hero`: the eyebrow, "Trade by tweeting. / Un-drainably.", the lede, the meta line and
 * the custody rail, each revealed on web's `.xt-boot` delays (0, 90, 440, 560, 680 ms; the payoff 300 ms).
 */
export function Hero() {
  const t = tradeXTokens(useTheme().name);
  const lede = TRADE_FROM_X.lede(X_HANDLE);
  return (
    <View style={styles.hero}>
      <View>
        <Boot delay={0}>
          <Text style={[styles.eyebrow, { color: t.eyebrow }]}>{TRADE_FROM_X.eyebrow}</Text>
        </Boot>
        <View style={styles.h1}>
          <Boot delay={90}>
            <Text style={[styles.headline, { color: t.ink }]}>{TRADE_FROM_X.headline}</Text>
          </Boot>
          <Payoff />
        </View>
        <Boot delay={440}>
          <Text style={[styles.lede, { color: t.gray400 }]}>
            {lede[0]}
            <Text style={{ color: t.white }}>{X_HANDLE}</Text>
            {lede[2]}
            <Text style={{ color: t.white }}>{lede[3]}</Text>
            {lede[4]}
          </Text>
        </Boot>
        <Boot delay={560} style={styles.meta}>
          <View style={styles.metaKeys}>
            <Dot />
            <Text style={[styles.metaText, styles.shrink, { color: t.gray500 }]}>{TRADE_FROM_X.yourKeys}</Text>
          </View>
          <Text style={[styles.metaText, { color: t.gray700 }]}>·</Text>
          <Text style={[styles.metaText, styles.shrink, { color: t.gray500 }]}>{TRADE_FROM_X.venue}</Text>
        </Boot>
      </View>
      <Boot delay={680}>
        <CustodyRail handle={X_HANDLE} />
      </Boot>
    </View>
  );
}

/** part-17.css `.xt-payoff` (fade-up + white → vermilion, 0.72 s at 0.3 s) and its `.xt-ul` underline drawn at 0.95 s. */
function Payoff() {
  const t = tradeXTokens(useTheme().name);
  const p = useOnce(720, 300, E_OUT, false);
  const ul = useOnce(550, 950, E_DRAW);
  const color = p.interpolate({ inputRange: [0, 1], outputRange: [t.white, t.v] });
  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [11, 0] });
  return (
    <Animated.View style={[styles.payoff, { opacity: p, transform: [{ translateY }] }]}>
      {/* Noto Serif JP ships no italic face; web's browser synthesises the oblique, the port skews the same word. */}
      <View style={styles.italic}>
        <Animated.Text style={[styles.payoffText, { color }]}>{TRADE_FROM_X.payoff}</Animated.Text>
      </View>
      <Animated.View style={[styles.ul, { backgroundColor: t.v, transform: [{ scaleX: ul }] }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 56, gap: 40 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 3.74, textTransform: "uppercase" },
  h1: { marginTop: 20 },
  headline: { fontFamily: FONT.headingHeavy, fontSize: 40.5, lineHeight: 38.88, letterSpacing: -1.215 },
  payoff: { alignSelf: "flex-start", marginTop: 12 },
  italic: { transform: [{ skewX: "-12deg" }] },
  payoffText: { fontFamily: FONT.stamp, fontSize: 42.12, lineHeight: 44 },
  ul: { position: "absolute", left: 0, right: 0, bottom: -1, height: 1, transformOrigin: "left" },
  lede: { marginTop: 24, fontFamily: FONT.body, fontSize: 15, lineHeight: 24.375 },
  meta: { marginTop: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  metaKeys: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  metaText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  shrink: { flexShrink: 1 },
});
