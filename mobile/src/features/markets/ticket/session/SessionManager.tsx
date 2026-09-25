import { formatBaseUnits, shortHex } from "@agari/core/units";
import { capResetsAtSec, dailyHeadroomBase } from "@agari/core/vault";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { priceCapText } from "@/features/session/caps";
import { SESSION } from "./copy";
import { LAMPORTS_PER_TAP, SESSION_KEY_TOPUP_LAMPORTS, SOL_DECIMALS } from "@/features/session/fees";
import type { SessionKeyView } from "@/features/session/view";
import { notify } from "@/lib/toast";
import { WebButton } from "~/components/portfolio/web/Button";
import { WEB_TYPE } from "~/theme/web/portfolio";
import { useSessionKey } from "~/web-shims/session-key-provider";
import { Detail, DetailList, hashText, Money, Numbers, sessionStyles, utcText } from "./Details";
import { ModalShell, useSessionTokens } from "./ModalShell";
import { useSponsorWhileOpen } from "./SessionModal";

function gasLine(view: SessionKeyView): string {
  const m = SESSION.manager;
  if (view.sponsor?.configured && view.sponsor.sponsor) {
    return view.sponsorRefusal ? m.gasSponsorDeclined(view.sponsorRefusal) : m.gasSponsor(shortHex(view.sponsor.sponsor, 8, 6));
  }
  if (view.keyFeeLamports === null || view.keyFeeLamports === 0n) return m.gasKeyEmpty;
  return m.gasKey(formatBaseUnits(view.keyFeeLamports, SOL_DECIMALS, { maxDp: 3, minDp: 0 }), Number(view.keyFeeLamports / LAMPORTS_PER_TAP));
}

/**
 * web's SessionManager: an expired or missing grant offers a new one; a live one shows its scope, the limits in a
 * surface-2 box, today's usage, the key's details and who pays — with top-up when the key is low, re-key when this
 * phone holds no key for the grant, and revoke.
 */
export function SessionManager({ open, onClose, onArmNew, symbol }: { open: boolean; onClose: () => void; onArmNew: () => void; symbol: string }) {
  const { color } = useSessionTokens();
  const { view, actions, busy } = useSessionKey();
  useSponsorWhileOpen(open);
  const m = SESSION.manager;
  const { grant, decimals } = view;
  const money = (base: bigint, large = false) => <Money base={base} decimals={decimals} symbol={symbol} large={large} />;
  const forget = view.key ? <WebButton variant="ghost" size="sm" label={m.forget} accessibilityLabel={`${m.forget} — ${m.forgetNote}`} onPress={() => void actions.forget()} /> : null;

  const revoke = async () => {
    const outcome = await actions.revoke();
    if (outcome.status === "confirmed") notify.neutral(m.revoke, m.revokeNote);
  };
  const rekey = async () => {
    const { outcome, topUpError } = await actions.rekey();
    if (outcome.status === "confirmed") notify.neutral(m.rekey, topUpError ?? SESSION.sheet.armedBody);
  };

  let body;
  if (view.status === "expired" || view.status === "disarmed" || !grant) {
    body = (
      <View style={styles.col}>
        {view.status === "expired" ? (
          <>
            <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]}>{m.expiredTitle}</Text>
            <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{m.expiredBody}</Text>
          </>
        ) : null}
        <WebButton size="lg" block label={m.armNew} onPress={onArmNew} disabled={view.status === "not-deployed" || view.status === "no-wallet"} />
        {forget}
      </View>
    );
  } else {
    const spentToday = grant.spentDay === Math.floor(view.nowSec / 86_400) ? grant.spentTodayBase : 0n;
    const needsKey = view.status === "grant-without-key";
    const keyPays = !(view.sponsor?.configured ?? false);
    const lowGas = keyPays && (view.keyFeeLamports ?? 0n) < LAMPORTS_PER_TAP;
    const limit = (label: string, value: ReactNode) => (
      <View style={styles.limit}>
        <Text style={[sessionStyles.label, { color: color.inkSecondary }]}>{label}</Text>
        {value}
      </View>
    );
    body = (
      <View style={styles.manager}>
        {needsKey ? (
          <View style={[styles.needsKey, { borderColor: color.hairline, backgroundColor: color.surface2 }]}>
            <Text style={[WEB_TYPE.bodyStrong, { color: color.ink }]}>{m.needsKeyTitle}</Text>
            <Text style={[WEB_TYPE.caption, { color: color.inkSecondary }]}>{m.needsKeyBody}</Text>
          </View>
        ) : null}
        <View style={styles.scope}>
          <Text style={[sessionStyles.label, { color: color.inkSecondary }]}>{m.scope}</Text>
          <Text style={[sessionStyles.value, { color: color.ink }]}>{SESSION.sheet.receipt.scopeValue}</Text>
        </View>
        <View>
          <Text style={[sessionStyles.heading, { color: color.ink }]}>{m.caps}</Text>
          <View style={[styles.limits, { borderColor: color.hairline, backgroundColor: color.surface2 }]}>
            {limit(m.perTap, money(grant.caps.maxStakePerTradeBase, true))}
            {limit(m.perDay, money(grant.caps.maxDailySpendBase, true))}
            {limit(m.positions, <Numbers strong text={String(grant.caps.maxOpenPositions)} />)}
            {limit(m.price, <Numbers strong text={priceCapText(grant, decimals) ?? m.noPriceCap} />)}
          </View>
        </View>
        <View>
          <Text style={[sessionStyles.heading, { color: color.ink }]}>{m.usage}</Text>
          <DetailList>
            <Detail label={m.spentToday}>{money(spentToday)}</Detail>
            <Detail label={m.headroom}>
              {money(dailyHeadroomBase(grant, view.nowSec))}
              <Text style={[sessionStyles.note, { color: color.inkSecondary }]}>
                {m.resets} {utcText(capResetsAtSec(view.nowSec) * 1000)}
              </Text>
            </Detail>
            <Detail label={m.budget}>{money(grant.budgetBase)}</Detail>
          </DetailList>
        </View>
        <View style={[styles.section, { borderTopColor: color.hairline }]}>
          <Text style={[sessionStyles.heading, { color: color.ink }]}>{m.details}</Text>
          <DetailList>
            <Detail label={m.key}>
              <Numbers text={hashText(grant.actor)} />
            </Detail>
            <Detail label={m.expires}>
              <Numbers text={utcText(grant.expiresAtSec * 1000, true)} />
            </Detail>
            <Detail label={m.gas}>{gasLine(view)}</Detail>
          </DetailList>
        </View>
        {lowGas && !needsKey ? <WebButton variant="secondary" size="sm" label={m.topUp(formatBaseUnits(SESSION_KEY_TOPUP_LAMPORTS, SOL_DECIMALS, { maxDp: 3, minDp: 0 }))} disabled={busy !== null} onPress={() => void actions.topUp()} /> : null}
        <View style={[styles.section, styles.col, { borderTopColor: color.hairline }]}>
          {needsKey ? <WebButton size="lg" block label={busy === "rekeying" ? m.rekeying : m.rekey} disabled={busy !== null} onPress={() => void rekey()} /> : null}
          <WebButton variant="secondary" size="lg" block label={busy === "revoking" ? m.revoking : m.revoke} disabled={busy !== null} onPress={() => void revoke()} />
          <Text style={[WEB_TYPE.caption, { color: color.inkMuted }]}>{m.revokeNote}</Text>
          {forget}
        </View>
      </View>
    );
  }

  return (
    <ModalShell open={open} onClose={onClose} title={m.title} description={m.description}>
      {body}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  col: { gap: 12 },
  manager: { gap: 24, minWidth: 0 },
  needsKey: { gap: 4, borderWidth: 1, borderRadius: 8, padding: 12 },
  scope: { gap: 6 },
  // `.limits`: two columns, 20 × 16 gaps, 16 in, a 12 px-radius hairline box on surface-2
  limits: { flexDirection: "row", flexWrap: "wrap", rowGap: 20, columnGap: 16, padding: 16, borderWidth: 1, borderRadius: 12 },
  limit: { width: "46%", flexGrow: 1, minWidth: 0, gap: 6 },
  section: { paddingTop: 20, borderTopWidth: 1 },
});
