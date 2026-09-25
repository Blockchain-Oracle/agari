import type { Diagnosis } from "@agari/core/types";
import { useBalanceSheet } from "@agari/markets/react";
import { Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { CAPS_DEFAULTS, termsFromForm, workedExample, type CapsForm } from "@/features/session/caps";
import { SESSION } from "./copy";
import { SESSION_KEY_TOPUP_LAMPORTS } from "@/features/session/fees";
import { notify } from "@/lib/toast";
import { WebButton } from "~/components/portfolio/web/Button";
import { ErrorState } from "~/components/portfolio/web/states";
import { FONT } from "~/theme";
import { useSessionKey } from "~/web-shims/session-key-provider";
import { CapsEditor } from "./CapsEditor";
import { CapabilityReceipt, sessionStyles } from "./Details";
import { Disclosure, ModalShell, useSessionTokens } from "./ModalShell";

/** web's `useSponsorWhileOpen`: the sponsor's status is read only while a session dialog is open. */
export function useSponsorWhileOpen(open: boolean): void {
  const { demandSponsor } = useSessionKey();
  useEffect(() => (open ? demandSponsor() : undefined), [open, demandSponsor]);
}

function formatMoney(base: bigint, decimals: number): string {
  const whole = base / 10n ** BigInt(decimals);
  const frac = ((base % 10n ** BigInt(decimals)) * 100n) / 10n ** BigInt(decimals);
  return `${whole}.${frac.toString().padStart(2, "0")}`;
}

/**
 * web's SessionModal, the arm flow: its first face is one strong sentence and one button (the AccountSetup card); the
 * caps sit behind "adjust" at sensible defaults and the capability receipt behind "what you are signing". A refusal
 * the key store gives as a field error ("unknown") shows over the button, others as the diagnosis.
 */
export function SessionModal({ open, onClose, symbol }: { open: boolean; onClose: () => void; symbol: string }) {
  const { t, color } = useSessionTokens();
  const { view, actions, busy } = useSessionKey();
  useSponsorWhileOpen(open);
  const [form, setForm] = useState<CapsForm>(CAPS_DEFAULTS);
  const [refusal, setRefusal] = useState<Diagnosis | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const sheet = useBalanceSheet(view.owner);
  const walletBase = sheet?.ok ? sheet.value.spendableBase : null;
  const decimals = view.decimals;
  const terms = view.key ? termsFromForm(form, decimals, view.key.address, view.nowSec) : null;
  const example = workedExample(form, decimals, symbol);
  const enabling = busy === "enabling";
  const depositShort = terms?.ok && walletBase !== null && walletBase < terms.amountBase;

  const submit = async () => {
    setRefusal(null);
    setFieldError(null);
    const { outcome, topUpError } = await actions.enable(form);
    if (outcome.status === "confirmed") {
      notify.neutral(SESSION.sheet.armed, topUpError ? topUpError : SESSION.sheet.armedBody);
      onClose();
      return;
    }
    if (outcome.status === "refused" && outcome.diagnosis.kind === "unknown") setFieldError(outcome.diagnosis.technical);
    else if (outcome.status !== "unknown") setRefusal(outcome.diagnosis);
  };

  const footer = (
    <>
      {fieldError ? <Text style={[sessionStyles.caption, { color: color.warning }]}>{fieldError}</Text> : null}
      {depositShort && walletBase !== null ? <Text style={[sessionStyles.caption, { color: color.warning }]}>{SESSION.sheet.errors.walletShort(`${formatMoney(walletBase, decimals)} ${symbol}`)}</Text> : null}
      {refusal ? <ErrorState diagnosis={refusal} retry={() => setRefusal(null)} /> : null}
      <WebButton
        size="lg"
        block
        label={enabling ? SESSION.sheet.ctaBusy : SESSION.sheet.cta}
        icon={enabling ? <ActivityIndicator size="small" color={color.onAccent} /> : undefined}
        disabled={enabling || view.status === "loading" || !view.owner}
        onPress={() => void submit()}
      />
    </>
  );

  const expiry = form.expiryHours >= 24 ? `${form.expiryHours / 24}d` : `${form.expiryHours}h`;
  return (
    <ModalShell open={open} onClose={onClose} title={SESSION.sheet.title} description={SESSION.sheet.intro} footer={footer}>
      <View style={[styles.card, { backgroundColor: t.setupBg, borderColor: t.setupBorder }]}>
        <View style={styles.line}>
          <Sparkles size={16} color={t.setupText} style={styles.icon} />
          <Text style={[styles.text, { color: t.setupText }]}>
            <Text style={[styles.lead, { color: color.ink }]}>{SESSION.modal.lead}</Text> {view.sponsor ? `${view.sponsor.configured ? SESSION.modal.sponsored : SESSION.modal.keyPays} ` : ""}
            {SESSION.modal.skip}
          </Text>
        </View>
      </View>
      <Disclosure summary={SESSION.modal.adjust(`${form.perTradeText} ${symbol}`, `${form.dailyText} ${symbol}`, expiry)}>
        <CapsEditor form={form} onChange={setForm} symbol={symbol} disabled={enabling} />
        {example ? <Text style={[sessionStyles.caption, { color: color.inkSecondary }]}>{example}</Text> : null}
        <Text style={[sessionStyles.caption, { color: color.inkMuted }]}>{SESSION.sheet.resets}</Text>
      </Disclosure>
      <Disclosure summary={SESSION.sheet.receiptTitle}>
        <CapabilityReceipt keyAddress={view.key?.address ?? null} expiresAtSec={view.nowSec + form.expiryHours * 3600} sponsorConfigured={view.sponsor?.configured ?? false} topUpLamports={SESSION_KEY_TOPUP_LAMPORTS} />
      </Disclosure>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  // `.setup-card` / `.setup-line` / `.setup-text` (11 px, 1.625; the lead Inter 600 in ink)
  card: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  icon: { marginTop: 2 },
  text: { flex: 1, fontFamily: FONT.body, fontSize: 11, lineHeight: 17.9 },
  lead: { fontFamily: FONT.bodyStrong },
});
