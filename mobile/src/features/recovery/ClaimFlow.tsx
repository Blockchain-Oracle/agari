import { isOk } from "@agari/core/schemas";
import { isAddress } from "@agari/core/types";
import { formatBaseUnits, shortHex } from "@agari/core/units";
import { useVaultSnapshot } from "@agari/markets/react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { CLAIM, X_LINK_STATUS } from "@/features/x/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Card, SectionHeader } from "~/components/kit";
import { Logo } from "~/components/logos/Logo";
import { FONT, TYPE, useTheme } from "~/theme";
import { Glyph } from "../strategies/Glyph";
import { Step } from "../x/StepRail";
import { X_SIGN_IN_ON_PHONE } from "../x/LinkStep";
import { useXLink } from "../x/useXLink";
import { ClaimTicket } from "./ClaimTicket";
import { RecoveryPanel } from "./RecoveryPanel";

/**
 * web's features/x/ClaimScreen.tsx: a trade made from an X mention lands in the Trading Balance of the wallet that X
 * account routes to. Prove it is you, find which wallet that is, connect it — then its balance is in your hands.
 * Below, the write recovery web runs silently (features/recovery), on demand.
 */
export function ClaimFlow() {
  const { color } = useTheme();
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

  return (
    <View style={styles.wrap}>
      <View style={styles.intro}>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>{CLAIM.eyebrow}</Text>
        {amount !== null ? (
          <>
            <Text style={[TYPE.dataHero, { color: color.ink }]} adjustsFontSizeToFit numberOfLines={1}>
              {`${amount} ${symbol}`}
            </Text>
            <Text style={[TYPE.stamp, { color: color.accent }]}>{CLAIM.headlineKnown}</Text>
            <Text style={[TYPE.body, { color: color.inkSecondary }]}>{CLAIM.ledeKnown(handle)}</Text>
          </>
        ) : (
          <>
            <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
              {CLAIM.headline[0]} {CLAIM.headline[1]}
            </Text>
            <Text style={[TYPE.body, { color: color.inkSecondary }]}>{CLAIM.lede}</Text>
          </>
        )}
      </View>

      <ClaimTicket amount={amount} handle={handle} done={ready} symbol={symbol} />

      <View>
        <Step n={1} title={CLAIM.steps.prove} state={proven ? "done" : "active"} filled={proven}>
          {session ? (
            <Done text={CLAIM.signedInAs(session.handle)} />
          ) : ready ? (
            <Done text={CLAIM.signedInAs(binding?.handle ?? null).replace("signed in", "linked")} />
          ) : link.loading ? (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{X_LINK_STATUS.checking}</Text>
          ) : !link.status?.configured ? (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{X_LINK_STATUS.unavailable}</Text>
          ) : (
            <View style={styles.row}>
              <Logo brand="x" size={16} />
              <Text style={[TYPE.caption, styles.flex, { color: color.inkMuted }]}>{X_SIGN_IN_ON_PHONE}</Text>
            </View>
          )}
        </Step>
        <Step n={2} title={CLAIM.steps.where} state={ready ? "done" : proven ? "active" : "idle"} filled={ready} last>
          {!address ? (
            <>
              {boundWallet ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.routesTo(shortHex(boundWallet))}</Text> : null}
              <Button label="Connect" onPress={() => router.push("/connect")} />
            </>
          ) : ready ? (
            <Done text={CLAIM.connected(shortHex(address))} />
          ) : !boundWallet ? (
            <>
              <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.noRoute}</Text>
              <Button label={CLAIM.setUp} variant="secondary" onPress={() => router.push("/trade-from-x")} />
            </>
          ) : session ? (
            <>
              <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.otherWallet(shortHex(boundWallet))}</Text>
              <Button
                label={link.busy === "link" ? CLAIM.linking : CLAIM.relink(session.handle ?? session.authorId)}
                loading={link.busy === "link"}
                disabled={link.busy !== ""}
                accessibilityHint="Signs a message with your wallet. No transaction."
                onPress={() => void link.link()}
              />
            </>
          ) : (
            <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{CLAIM.routesTo(shortHex(boundWallet))}</Text>
          )}
          {link.error ? <Text style={[TYPE.caption, { color: color.loss }]}>{link.error}</Text> : null}
        </Step>
      </View>

      {ready ? (
        <Card tone="accent">
          <Done text={CLAIM.thisWallet} />
          <Button label={CLAIM.openPortfolio} trailing="→" onPress={() => router.push("/portfolio")} />
        </Card>
      ) : null}
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{CLAIM.footnote}</Text>

      <SectionHeader title="Unfinished sends" desc="Recover a trade whose confirmation never reached this phone." />
      <RecoveryPanel />
    </View>
  );
}

function Done({ text }: { text: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <Glyph name="check" tint={color.profit} />
      <Text style={[TYPE.bodyStrong, styles.flex, { color: color.ink, fontFamily: FONT.bodyStrong }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  intro: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
});
