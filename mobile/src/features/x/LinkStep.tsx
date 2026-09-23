import { StyleSheet, Text, View } from "react-native";
import { TRADE_FROM_X, X_LINK_STATUS } from "@/features/x/copy";
import { Button } from "~/components/kit";
import { Logo } from "~/components/logos/Logo";
import { TYPE, useTheme } from "~/theme";
import { Glyph } from "../strategies/Glyph";
import type { XLinkState } from "./useXLink";

/**
 * Sign-in with X is an OAuth round-trip whose session lives in a web cookie; the phone cannot receive it until the
 * API hands the app its session (see the X rail note in the report). What the phone does have is the durable route,
 * read by wallet: an account linked anywhere shows here, and a session present on this phone links with one signature.
 */
export const X_SIGN_IN_ON_PHONE = "Link your X account on useagari.xyz from a computer; it appears here once linked.";

/** web's features/x/LinkStep.tsx: linked, signed in and ready to link, or how to sign in. */
export function LinkStep({ link, enabled }: { link: XLinkState; enabled: boolean }) {
  const { color } = useTheme();
  const session = link.status?.session ?? null;
  const binding = link.status?.binding ?? null;
  if (link.loading) return <Text style={[TYPE.caption, { color: color.inkMuted }]}>{X_LINK_STATUS.checking}</Text>;
  if (link.linked && binding) {
    return (
      <View style={styles.row}>
        <Glyph name="check" tint={color.profit} />
        <Text style={[TYPE.bodyStrong, { color: color.profit }]}>{TRADE_FROM_X.linked(binding.handle ?? binding.authorId)}</Text>
      </View>
    );
  }
  if (!link.status?.configured) return <Text style={[TYPE.caption, { color: color.inkMuted }]}>{X_LINK_STATUS.unavailable}</Text>;
  if (!session) {
    return (
      <>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{TRADE_FROM_X.linkLede}</Text>
        <View style={styles.row}>
          <Logo brand="x" size={16} />
          <Text style={[TYPE.caption, styles.flex, { color: color.inkMuted }]}>{X_SIGN_IN_ON_PHONE}</Text>
        </View>
        <Button label="Check again" variant="outline" size="sm" block={false} onPress={() => void link.refresh()} />
      </>
    );
  }
  return (
    <>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>signed in as @{session.handle ?? session.authorId}</Text>
      <Button
        label={link.busy === "link" ? TRADE_FROM_X.linking : TRADE_FROM_X.linkAs(session.handle ?? session.authorId)}
        loading={link.busy === "link"}
        disabled={!enabled || link.busy !== ""}
        accessibilityHint="Signs a message with your wallet. No transaction."
        onPress={() => void link.link()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
});
