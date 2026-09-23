import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { useBalanceSheet } from "@agari/markets/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useVenue } from "@/features/markets/useVenue";
import { TRADE_FROM_X, X_CARD, X_HANDLE } from "@/features/x/copy";
import { useXReceipts } from "@/features/x/useXReceipts";
import { docsUrl } from "@/lib/docs-url";
import { useWalletSession } from "@/lib/wallet-session";
import { Button, Card, Hero } from "~/components/kit";
import { Avatar } from "~/components/wallet/Avatar";
import { openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { Glyph } from "../strategies/Glyph";
import { ReviewGate } from "../strategies/ReviewGate";
import { CustodyRail } from "./CustodyRail";
import { FundReceipt } from "./FundReceipt";
import { InstructionBuilder } from "./InstructionBuilder";
import { LinkStep } from "./LinkStep";
import { PermissionPanel } from "./PermissionPanel";
import { ReceiptsList } from "./ReceiptsList";
import { RelayStatus } from "./RelayStatus";
import { Step } from "./StepRail";
import { useXGrant } from "./useXGrant";
import { useXLink } from "./useXLink";

/**
 * web's features/x/TradeFromXScreen.tsx: connect → fund and authorise the bounded executor → link X → post your call.
 * The custody rail is the argument; every money step is a reviewed transaction the wallet signs.
 */
export function TradeFromX() {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "tUSDC";
  const link = useXLink();
  const grant = useXGrant();
  const receipts = useXReceipts(address ?? null);
  const sheet = useBalanceSheet(address);
  const walletBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const [amount, setAmount] = useState("5");
  const executor = link.status?.executor ?? null;
  const permission = grant.permission(executor);
  const funded = permission === "ready";
  const step = !address ? 1 : !funded ? 2 : !link.linked ? 3 : 4;
  const error = grant.error || link.error;
  const okLine = grant.ok || link.ok;
  const handle = link.status?.binding?.handle ?? link.status?.session?.handle ?? null;
  const money = (base: bigint) => `${formatBaseUnits(base, grant.decimals)} ${symbol}`;

  return (
    <View style={styles.wrap}>
      <Hero kicker={TRADE_FROM_X.eyebrow} title={`${TRADE_FROM_X.headline} ${TRADE_FROM_X.payoff.replace(/⁠/g, "")}`}>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>
          {TRADE_FROM_X.lede(X_HANDLE)[0]}
          <Text style={{ color: color.ink, fontFamily: FONT.bodyStrong }}>{X_HANDLE}</Text>
          {TRADE_FROM_X.lede(X_HANDLE)[2]}
          <Text style={{ color: color.ink, fontFamily: FONT.bodyStrong }}>{TRADE_FROM_X.lede(X_HANDLE)[3]}</Text>
          {TRADE_FROM_X.lede(X_HANDLE)[4]}
        </Text>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>
          {TRADE_FROM_X.yourKeys} · {TRADE_FROM_X.venue}
        </Text>
      </Hero>
      <CustodyRail handle={X_HANDLE} />

      <Text style={[TYPE.labelMicro, { color: color.accent }]}>{TRADE_FROM_X.setup}</Text>
      <View>
        <Step n={1} title={TRADE_FROM_X.steps.connect} state={step > 1 ? "done" : "active"} filled={step > 1}>
          {address ? (
            <View style={[styles.chip, { borderColor: color.hairline }]}>
              <Avatar address={address} size={24} />
              <Text style={[TYPE.data, styles.flex, { color: color.ink }]}>{`${address.slice(0, 4)}…${address.slice(-4)}`}</Text>
              <Text style={[TYPE.labelMicro, { color: color.profit }]}>{TRADE_FROM_X.connected}</Text>
            </View>
          ) : (
            <Button label="Connect" onPress={() => router.push("/connect")} />
          )}
        </Step>
        <Step n={2} title={TRADE_FROM_X.steps.fund} state={funded ? "done" : step === 2 ? "active" : "idle"} filled={step > 2}>
          {!address ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>Connect your wallet to check your X balance and permission.</Text> : null}
          {address && (grant.grant || grant.pendingUpdate || !["ready", "unfunded"].includes(permission)) ? (
            <>
              {grant.balanceBase !== null ? (
                <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
                  X balance · <Text style={[TYPE.data, { color: color.ink }]}>{money(grant.balanceBase)}</Text>
                </Text>
              ) : null}
              <PermissionPanel grant={grant} executor={executor} symbol={symbol} disabled={link.walletMismatch || Boolean(link.busy)} />
            </>
          ) : null}
          {funded && grant.grant ? (
            <ReviewGate
              cta={grant.busy === "cashout" ? `${X_CARD.cashingOut}…` : X_CARD.cashOut}
              variant="outline"
              title="Cash out your X balance"
              lines={[
                { label: "Returns to Trading Balance", value: money(grant.grant.budgetBase) },
                { label: "X trading", value: "stops until you fund again", tone: "muted" },
              ]}
              maxLoss={null}
              confirmLabel="Slide to cash out"
              busy={grant.busy === "cashout"}
              disabled={Boolean(grant.busy)}
              onConfirm={grant.cashOut}
            />
          ) : grant.deployed === false ? (
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{TRADE_FROM_X.receipt.notDeployed}</Text>
          ) : address && permission === "unfunded" ? (
            <FundReceipt
              amount={amount}
              setAmount={setAmount}
              disabled={!grant.readable || Boolean(grant.busy) || link.walletMismatch}
              depositing={grant.busy === "fund"}
              firstTime={grant.grant === null}
              decimals={grant.decimals}
              symbol={symbol}
              walletBase={walletBase}
              onDeposit={(amountBase) => grant.fund(amountBase, executor)}
            />
          ) : null}
        </Step>
        <Step n={3} title={TRADE_FROM_X.steps.link} state={link.linked ? "done" : step === 3 ? "active" : "idle"} filled={step > 3} last>
          <LinkStep link={link} enabled={Boolean(address) && funded} />
        </Step>
      </View>

      {error ? (
        <View style={[styles.note, { backgroundColor: color.lossWash }]} accessibilityRole="alert">
          <Text style={[TYPE.bodyStrong, { color: color.loss }]}>{error}</Text>
        </View>
      ) : null}
      {okLine ? (
        <View style={[styles.note, { backgroundColor: color.profitWash }]} accessibilityLiveRegion="polite">
          <Text style={[TYPE.bodyStrong, { color: color.profit }]}>{okLine}</Text>
        </View>
      ) : null}

      <Card tone={step === 4 ? "accent" : "plain"}>
        <Text style={[TYPE.labelMicro, { color: color.accent }]}>Trade from X</Text>
        <InstructionBuilder enabled={step === 4} balanceBase={grant.balanceBase} decimals={grant.decimals} symbol={symbol} handle={handle} />
        <RelayStatus health={link.status?.relay} />
      </Card>

      <View style={styles.trust}>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{TRADE_FROM_X.noWithdraw}</Text>
        <ProofLink label={TRADE_FROM_X.proofs.contract} href={docsUrl("architecture/programs")} />
        <ProofLink label={TRADE_FROM_X.proofs.caps} href={docsUrl("trading/tap-trading")} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{TRADE_FROM_X.testnetNote}</Text>
      </View>

      {address ? (
        <ReceiptsList receipts={receipts?.receipts ?? []} configured={receipts?.configured ?? false} decimals={grant.decimals} symbol={symbol} />
      ) : null}
    </View>
  );
}

/** web's ProofLink: a claim with the docs page that shows it. */
function ProofLink({ label, href }: { label: string; href: string }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={() => void openExternal(href)} accessibilityRole="link" style={styles.proof}>
      <Glyph name="external" size={12} />
      <Text style={[TYPE.caption, styles.flex, { color: color.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.full, paddingHorizontal: 8, minHeight: 40 },
  flex: { flex: 1 },
  note: { borderRadius: RADIUS.md, padding: 12 },
  trust: { gap: 4 },
  proof: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
});
