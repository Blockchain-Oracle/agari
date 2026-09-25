import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { router, type Href } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { TRADE_FROM_X } from "@/features/x/copy";
import { useXReceipts } from "@/features/x/useXReceipts";
import { docsUrl } from "@/lib/docs-url";
import { useWalletSession } from "@/lib/wallet-session";
import { openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { CHROME } from "~/theme/chrome";
import { tradeXTokens } from "~/theme/web/products/trade-x";
import { FundReceipt } from "./FundReceipt";
import { Hero } from "./Hero";
import { InstructionBuilder } from "./InstructionBuilder";
import { IslandStrip } from "./IslandStrip";
import { LinkStep } from "./LinkStep";
import { PermissionPanel } from "./PermissionPanel";
import { ReceiptsList } from "./ReceiptsList";
import { RelayStatus } from "./RelayStatus";
import { Dot, IdentityChip, ProofLink, Step } from "./StepSpine";
import { useXGrant } from "./useXGrant";
import { useXLink } from "./useXLink";
import { usePullRefresh } from "~/components/kit/PullRefresh";

/** x-card.css `scroll-margin-top: 8rem` for the page's two anchors. */
const ANCHOR_MARGIN = 120;

/**
 * web's features/x/TradeFromXScreen.tsx — "X-trade", the dark island: its own strip, the hero with the custody rail,
 * then connect → fund + authorize → link X, the instruction builder, the trust footer and the receipts. Every money
 * button submits straight to the wallet, which is the confirmation, as on web.
 */
export function TradeFromX({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const { name, color } = useTheme();
  const t = tradeXTokens(name);
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const link = useXLink();
  const grant = useXGrant();
  const receipts = useXReceipts(address ?? null);
  const [amount, setAmount] = useState("5");
  const scroll = useRef<ScrollView>(null);
  const flowY = useRef(0);
  const composerY = useRef(0);

  const executor = link.status?.executor ?? null;
  const permission = grant.permission(executor);
  const funded = permission === "ready";
  const linked = Boolean(link.status?.binding) && !link.needsLink && !link.walletMismatch;
  const step = !address ? 1 : !funded ? 2 : !linked ? 3 : 4;
  const error = grant.error || link.error;

  const refreshControl = usePullRefresh(onRefresh);
  const recover = (href: string) => {
    const anchor = href.startsWith("/trade-from-x#") ? href.split("#")[1] : null;
    if (!anchor) return router.push(href as Href);
    const y = anchor === "x-instruction" ? flowY.current + composerY.current : flowY.current;
    scroll.current?.scrollTo({ y: Math.max(0, y - ANCHOR_MARGIN), animated: true });
  };

  return (
    <View style={[styles.page, { backgroundColor: t.bg }]}>
      <ScrollView
        ref={scroll}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        <IslandStrip />
        <Hero />
        <View style={styles.flow} onLayout={(e) => { flowY.current = e.nativeEvent.layout.y; }}>
          <Text style={[styles.flowLabel, { color: t.gray500 }]}>{TRADE_FROM_X.setup}</Text>
          <Step n="1" title={TRADE_FROM_X.steps.connect} state={step > 1 ? "done" : "active"} spine={{ from: 1, cur: step }}>
            {address ? (
              <IdentityChip addr={address} />
            ) : (
              <Pressable onPress={() => router.push("/connect")} accessibilityRole="button" style={({ pressed }) => [styles.connect, { backgroundColor: pressed ? color.accentPressed : color.accent }]}>
                <Text style={[styles.connectText, { color: t.white }]}>Connect</Text>
              </Pressable>
            )}
          </Step>
          <Step n="2" title={TRADE_FROM_X.steps.fund} state={funded ? "done" : step === 2 ? "active" : "idle"} spine={{ from: 2, cur: step }}>
            {!address ? <Text style={[styles.lede, { color: t.gray400 }]}>Connect your wallet to check your X balance and permission.</Text> : null}
            {address && (grant.grant || grant.pendingUpdate || !["ready", "unfunded"].includes(permission)) ? (
              <View>
                {grant.balanceBase !== null ? (
                  <Text style={[styles.lede, { color: t.gray400 }]}>
                    X balance · <Text style={styles.strong}>{formatBaseUnits(grant.balanceBase, grant.decimals)} {symbol}</Text>
                  </Text>
                ) : null}
                <PermissionPanel grant={grant} executor={executor} symbol={symbol} disabled={link.walletMismatch || Boolean(link.busy)} />
              </View>
            ) : null}
            {funded ? (
              <Text style={[styles.portfolio, { color: t.v }]} accessibilityRole="link" onPress={() => router.navigate("/portfolio")}>
                Manage X balance in Portfolio ↗
              </Text>
            ) : grant.deployed === false ? (
              <Text style={[styles.lede, { color: t.gray400 }]}>{TRADE_FROM_X.receipt.notDeployed}</Text>
            ) : permission === "unfunded" ? (
              <FundReceipt
                amount={amount}
                setAmount={setAmount}
                disabled={!address || !grant.readable || Boolean(grant.busy) || link.walletMismatch}
                depositing={grant.busy === "fund"}
                firstTime={grant.grant === null}
                decimals={grant.decimals}
                symbol={symbol}
                onDeposit={(amountBase) => void grant.fund(amountBase, executor)}
              />
            ) : null}
          </Step>
          <Step n="3" title={TRADE_FROM_X.steps.link} state={linked ? "done" : step === 3 ? "active" : "idle"} spine={{ from: 3, cur: step }} isLast>
            <LinkStep link={link} enabled={Boolean(address) && funded} />
          </Step>

          {error ? (
            <View style={[styles.err, { borderColor: t.errBorder, backgroundColor: t.errBg }]} accessibilityRole="alert">
              <Text style={[styles.errText, { color: t.errInk }]}>{error}</Text>
            </View>
          ) : null}
          {grant.ok || link.ok ? <Text style={[styles.ok, { color: t.m }]} accessibilityLiveRegion="polite">{grant.ok || link.ok}</Text> : null}

          <View
            style={[styles.composer, step === 4 ? { borderColor: t.liveBorder, backgroundColor: t.liveBg } : { borderColor: t.cardBorder, backgroundColor: t.cardBg }]}
            onLayout={(e) => { composerY.current = e.nativeEvent.layout.y; }}
          >
            <Text style={[styles.eyebrow, { color: t.gray500 }]}>Trade from X</Text>
            <InstructionBuilder enabled={step === 4} balanceBase={grant.balanceBase} decimals={grant.decimals} symbol={symbol} />
            <RelayStatus health={link.status?.relay} />
          </View>

          <View style={[styles.trust, { borderTopColor: t.cardBorder }]}>
            <View style={styles.meta}>
              <Dot v />
              <Text style={[styles.metaText, { color: t.gray500 }]}>{TRADE_FROM_X.noWithdraw}</Text>
            </View>
            <ProofLink onPress={() => void openExternal(docsUrl("architecture/programs"))}>{TRADE_FROM_X.proofs.contract}</ProofLink>
            <ProofLink onPress={() => void openExternal(docsUrl("trading/tap-trading"))}>{TRADE_FROM_X.proofs.caps}</ProofLink>
            <Text style={[styles.trustNote, { color: t.gray600 }]}>{TRADE_FROM_X.testnetNote}</Text>
          </View>

          {address ? (
            <ReceiptsList receipts={receipts?.receipts ?? []} configured={receipts?.configured ?? false} decimals={grant.decimals} symbol={symbol} onRecover={recover} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  flow: { paddingHorizontal: 20, paddingBottom: CHROME.dockClearance },
  flowLabel: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 3.3, textTransform: "uppercase", marginBottom: 28 },
  connect: { alignSelf: "flex-start", height: 48, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  connectText: { fontFamily: FONT.bodyMedium, fontSize: 15, lineHeight: 22.5 },
  lede: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, marginBottom: 16 },
  strong: { fontFamily: FONT.bodyStrong },
  portfolio: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24 },
  err: { marginTop: 20, borderRadius: 12, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
  errText: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
  ok: { marginTop: 12, fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
  composer: { marginTop: 40, borderRadius: 16, borderWidth: 1, padding: 24 },
  eyebrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 2.64, textTransform: "uppercase", marginBottom: 12 },
  trust: { marginTop: 32, borderTopWidth: 1, paddingTop: 24, gap: 10 },
  meta: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaText: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  trustNote: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8 },
});
