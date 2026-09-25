import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { TRADE_FROM_X, X_LINK_STATUS } from "@/features/x/copy";
import { FONT, useTheme } from "~/theme";
import { tradeXTokens } from "~/theme/web/products/trade-x";
import { Dot, Tick } from "./StepSpine";
import type { XLinkState } from "./useXLink";

/**
 * Sign-in with X is an OAuth round-trip whose session lives in a web cookie; the phone cannot receive it, and the app
 * never hands a product route to a browser. The durable route is read by wallet, so an account linked on the web
 * shows here, and a session present on this phone links with one signature.
 */
export const X_SIGN_IN_ON_PHONE = "Link your X account on useagari.xyz from a computer; it appears here once linked.";

/** web's LinkStep.tsx `XGlyph`: the X mark, 14 px, in the pill's ink. */
function XGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill={color}>
      <Path d="M18.9 1.2h3.7l-8 9.1 9.4 12.5h-7.4l-5.8-7.6-6.6 7.6H.5l8.5-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.4h2L6.5 3.3H4.4l13.2 17.3Z" />
    </Svg>
  );
}

/** web's LinkStep.tsx — step 3: linked, signed in and ready to link with a wallet signature, or sign in with X. */
export function LinkStep({ link, enabled }: { link: XLinkState; enabled: boolean }) {
  const t = tradeXTokens(useTheme().name);
  const session = link.status?.session ?? null;
  const binding = link.status?.binding ?? null;
  if (link.loading) return <Text style={[styles.lede, { color: t.gray400 }]} accessibilityLiveRegion="polite">{X_LINK_STATUS.checking}</Text>;
  if (binding && !link.needsLink && !link.walletMismatch) {
    return (
      <View style={styles.done}>
        <Tick />
        <Text style={[styles.doneText, { color: t.m }]}>{TRADE_FROM_X.linked(binding.handle ?? binding.authorId)}</Text>
      </View>
    );
  }
  if (!link.status?.configured) return <Text style={[styles.lede, { color: t.gray400 }]}>{X_LINK_STATUS.unavailable}</Text>;
  if (!session) {
    return (
      <>
        <Text style={[styles.lede, { color: t.gray400 }]}>{TRADE_FROM_X.linkLede}</Text>
        {/* web's `aria-disabled` X pill: the OAuth session cannot reach the app, so it re-reads the route instead. */}
        <Pressable
          onPress={() => void link.refresh()}
          accessibilityRole="button"
          accessibilityHint={X_SIGN_IN_ON_PHONE}
          style={({ pressed }) => [styles.pill, { backgroundColor: t.ink }, !enabled && styles.muted, pressed && styles.pressed]}
        >
          <XGlyph color={t.bg} />
          <Text style={[styles.pillText, { color: t.bg }]}>{TRADE_FROM_X.signIn}</Text>
        </Pressable>
      </>
    );
  }
  const off = !enabled || link.busy !== "";
  return (
    <>
      <View style={styles.signedIn}>
        <Dot />
        <Text style={[styles.lede, styles.flush, { color: t.gray400 }]}>{`signed in as @${session.handle ?? session.authorId}`}</Text>
      </View>
      <Pressable
        disabled={off}
        onPress={() => void link.link()}
        accessibilityRole="button"
        style={({ pressed }) => [styles.pill, { backgroundColor: t.v }, off && styles.muted, pressed && styles.pressed]}
      >
        <Text style={[styles.pillText, { color: t.bg }]}>
          {link.busy === "link" ? TRADE_FROM_X.linking : TRADE_FROM_X.linkAs(session.handle ?? session.authorId)}
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  lede: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, marginBottom: 16 },
  flush: { marginBottom: 0, flexShrink: 1 },
  signedIn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16 },
  done: { flexDirection: "row", alignItems: "center", gap: 8 },
  doneText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, flexShrink: 1 },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 9999, paddingVertical: 10, paddingHorizontal: 24 },
  pillText: { fontFamily: FONT.heading, fontSize: 14, lineHeight: 22.4 },
  muted: { opacity: 0.4 },
  pressed: { transform: [{ translateY: 1 }, { scale: 0.99 }] },
});
