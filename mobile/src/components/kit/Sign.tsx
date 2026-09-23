import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useWalletSession } from "@/lib/wallet-session";
import { SlideToConfirm } from "~/components/ui/SlideToConfirm";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { useWalletKind } from "~/wallet/WalletProvider";
import type { WalletKind } from "~/wallet/choices";
import { Button } from "./Button";
import { Row, Rows } from "./Controls";

const WALLET_NAME: Record<WalletKind, string> = { phantom: "Phantom", solflare: "Solflare", mwa: "your wallet", practice: "the practice wallet" };

/** Where a signature is asked for: the wallet app by name, or the device-local practice key (no hand-off). */
export function approvalLine(kind: WalletKind | null): string {
  if (kind === "practice") return "The practice wallet on this phone signs it. Devnet only, no real value.";
  if (kind === "phantom" || kind === "solflare") return `${WALLET_NAME[kind]} opens to approve. Nothing is sent until you approve there.`;
  return "Your wallet asks you to approve. Nothing is sent until you approve there.";
}

/** Shown in place of a write surface until a wallet is connected. Reading never needs one. */
export function ConnectGate({ why, children }: { why: string; children?: ReactNode }) {
  const { color } = useTheme();
  const session = useWalletSession();
  if (session.isConnected) return <>{children}</>;
  return (
    <View style={[styles.gate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Connect a wallet</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{why}</Text>
      <Button label={session.isConnecting ? "Reconnecting…" : "Connect"} loading={session.isConnecting} onPress={() => router.push("/connect")} />
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>No wallet app? The practice wallet works on devnet with test funds.</Text>
    </View>
  );
}

export interface QuoteLine {
  label: string;
  value: string;
  tone?: "profit" | "loss" | "accent" | "muted";
  hint?: string;
}

export type SignPhase = "review" | "signing" | "sending" | "done" | "failed";

interface SignReviewProps {
  /** What is being signed, in one line ("Buy 12 UP on TSLA · 15m"). */
  title: string;
  /** The exact quote the transaction was built from, top to bottom. */
  lines: readonly QuoteLine[];
  /** The most this can cost: always shown, always in the loss ink. Null only when nothing is at risk (a claim). */
  maxLoss: string | null;
  /** The slide's word ("Slide to buy UP"). */
  confirmLabel: string;
  onConfirm: () => void;
  phase?: SignPhase;
  /** A refusal that blocks signing (not enough funds, Window locked); the slide stays disabled. */
  blocker?: string | null;
  tone?: "profit" | "loss" | "accent";
}

/**
 * The one gate before any signature: the exact quote, the maximum loss, which wallet will ask, then a deliberate slide.
 * The slide only starts the request; the wallet's own approval is what signs.
 */
export function SignReview({ title, lines, maxLoss, confirmLabel, onConfirm, phase = "review", blocker, tone = "accent" }: SignReviewProps) {
  const { color } = useTheme();
  const kind = useWalletKind();
  const ink = tone === "profit" ? color.profit : tone === "loss" ? color.loss : color.accent;
  const busy = phase === "signing" || phase === "sending";
  return (
    <View style={[styles.review, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{title}</Text>
      <Rows>
        {lines.map((line) => (
          <Row key={line.label} label={line.label} value={line.value} tone={line.tone} hint={line.hint} />
        ))}
        {maxLoss !== null ? <Row label="Maximum loss" value={maxLoss} tone="loss" strong /> : null}
      </Rows>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{approvalLine(kind)}</Text>
      {blocker ? <Text style={[TYPE.caption, { color: color.loss }]}>{blocker}</Text> : null}
      {busy ? (
        <View style={[styles.busy, { backgroundColor: color.surface2 }]} accessibilityLiveRegion="polite">
          <ActivityIndicator color={ink} />
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{phase === "signing" ? `Waiting for ${kind ? WALLET_NAME[kind] : "your wallet"}…` : "Sending to devnet…"}</Text>
        </View>
      ) : (
        <SlideToConfirm label={confirmLabel} onConfirm={onConfirm} disabled={!!blocker || phase === "done"} tone={ink} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  review: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  busy: { height: 60, borderRadius: RADIUS.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
});
