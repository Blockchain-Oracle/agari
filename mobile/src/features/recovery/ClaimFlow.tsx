import { isOk } from "@agari/core/schemas";
import { isAddress } from "@agari/core/types";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { useVaultSnapshot } from "@agari/markets/react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { CLAIM, X_LINK_STATUS } from "@/features/x/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { WebButton } from "~/components/portfolio/web";
import { FONT, useTheme } from "~/theme";
import { activityTokens } from "~/theme/web/portfolio-activity";
import { X_SIGN_IN_ON_PHONE } from "../x/LinkStep";
import { useXLink } from "../x/useXLink";
import { Done, Hint, Step, XPill } from "./ClaimParts";
import { ClaimTicket } from "./ClaimTicket";

/**
 * web features/x/ClaimScreen.tsx on a phone (`.xc-grid` single column: the ticket first, then the flow): a trade made
 * from an X mention lands in the Trading Balance of the wallet that X account routes to. Prove it is you, connect that
 * wallet, and the balance is yours. The phone cannot hold web's X session cookie, so a route already linked counts as
 * proven and "Sign in with X" re-reads it.
 */
export function ClaimFlow() {
  const { name, color } = useTheme();
  const t = activityTokens(name);
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const link = useXLink();
  const session = link.status?.session ?? null;
  const binding = link.status?.binding ?? null;
  const boundWallet = binding?.wallet ?? null;
  const vault = useVaultSnapshot(boundWallet !== null && isAddress(boundWallet) ? boundWallet : null);
  const value = vault && vault.ok ? vault.value : null;
  const amount = value ? formatBaseUnits(value.account.availableBase, value.decimals) : null;
  const handle = session?.handle ?? binding?.handle ?? null;
  const ready = Boolean(address && boundWallet && boundWallet === address);
  const proven = Boolean(session) || ready;
  const connect = () => router.push("/connect");

  return (
    <View style={styles.grid}>
      <ClaimTicket amount={amount} handle={handle} done={ready} symbol={symbol} />

      <View>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: color.accent }]}>{CLAIM.eyebrow}</Text>
          {amount !== null ? (
            <Text style={[styles.h1, { color: color.ink }]} accessibilityRole="header">
              {`${amount} ${symbol}`} <Text style={[styles.h1Word, { color: color.inkSecondary }]}>{CLAIM.headlineKnown}</Text>
            </Text>
          ) : (
            <Text style={[styles.h1Ask, { color: color.ink }]} accessibilityRole="header">
              {CLAIM.headline[0]}
              {"\n"}
              {CLAIM.headline[1]}
            </Text>
          )}
          <Text style={[styles.lede, { color: color.inkSecondary }]}>{amount !== null ? CLAIM.ledeKnown(handle) : CLAIM.lede}</Text>
        </View>

        <Step index={1} label={CLAIM.steps.prove} done={proven}>
          {session ? (
            <Done text={CLAIM.signedInAs(session.handle)} />
          ) : ready ? (
            <Done text={CLAIM.signedInAs(binding?.handle ?? null)} />
          ) : link.loading ? (
            <Hint text={X_LINK_STATUS.checking} />
          ) : !link.status?.configured ? (
            <Hint text={X_LINK_STATUS.unavailable} />
          ) : (
            <XPill label={CLAIM.signIn} glyph onPress={() => void link.refresh()} hint={X_SIGN_IN_ON_PHONE} />
          )}
        </Step>

        <Step index={2} label={CLAIM.steps.where} done={ready} dim={!proven}>
          {!proven ? (
            <View style={address ? null : styles.muted} pointerEvents={address ? "auto" : "none"}>
              <WebButton label="Connect" onPress={connect} />
            </View>
          ) : !boundWallet ? (
            <>
              <Hint text={CLAIM.noRoute} />
              <View style={styles.mt}>
                <XPill label={CLAIM.setUp} onPress={() => router.push("/trade-from-x")} />
              </View>
            </>
          ) : !address ? (
            <>
              <Hint text={CLAIM.routesTo(shortHex(boundWallet))} />
              <View style={styles.mt}>
                <WebButton label="Connect" onPress={connect} />
              </View>
            </>
          ) : ready ? (
            <Done text={CLAIM.connected(shortHex(address))} />
          ) : (
            <>
              <Hint text={CLAIM.otherWallet(shortHex(boundWallet))} />
              <View style={styles.mt}>
                <XPill
                  label={link.busy === "link" ? CLAIM.linking : CLAIM.relink(session?.handle ?? session?.authorId ?? handle ?? "")}
                  disabled={link.busy !== "" || !session}
                  onPress={() => void link.link()}
                />
              </View>
            </>
          )}
          {link.error ? <Text style={[styles.err, { color: color.loss }]}>{link.error}</Text> : null}
        </Step>

        {ready ? (
          <View style={[styles.slab, { backgroundColor: t.slabFill, borderColor: t.slabBorder }]}>
            <View style={styles.slabTitle}>
              <View style={[styles.dot, { backgroundColor: color.profit }]} />
              <Text style={[styles.slabText, { color: color.profit }]}>{CLAIM.thisWallet}</Text>
            </View>
            <Pressable onPress={() => router.push("/portfolio")} accessibilityRole="link" style={({ pressed }) => [styles.cta, { backgroundColor: color.accent }, pressed ? styles.pressed : null]}>
              <Text style={[styles.ctaText, { color: t.ctaInk }]}>{CLAIM.openPortfolio}</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.foot, { color: color.inkSecondary }]}>{CLAIM.footnote}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 48 },
  intro: { marginBottom: 40 },
  eyebrow: { fontFamily: FONT.headingSemi, fontSize: 13, lineHeight: 20.8, letterSpacing: 2.86, textTransform: "uppercase", marginBottom: 16 },
  h1: { fontFamily: FONT.headingHeavy, fontSize: 60.3, lineHeight: 60.3, letterSpacing: -1.8 },
  h1Word: { fontFamily: FONT.heading, fontSize: 28.14, letterSpacing: 0 },
  h1Ask: { fontFamily: FONT.headingHeavy, fontSize: 52, lineHeight: 54.6, letterSpacing: -1.56 },
  lede: { fontFamily: FONT.headingRegular, fontSize: 17, lineHeight: 25.5, marginTop: 16 },
  mt: { marginTop: 12 },
  muted: { opacity: 0.4 },
  err: { fontFamily: FONT.headingRegular, fontSize: 13, lineHeight: 19.5, marginTop: 10 },
  slab: { marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 24 },
  slabTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  slabText: { flexShrink: 1, fontFamily: FONT.headingHeavy, fontSize: 18, lineHeight: 28.8 },
  cta: { marginTop: 12, borderRadius: 16, padding: 20, alignItems: "center" },
  ctaText: { fontFamily: FONT.headingHeavy, fontSize: 18.49, lineHeight: 29.6, letterSpacing: -0.18 },
  pressed: { opacity: 0.9 },
  foot: { marginTop: 48, fontFamily: FONT.headingRegular, fontSize: 13, lineHeight: 20.8 },
});
