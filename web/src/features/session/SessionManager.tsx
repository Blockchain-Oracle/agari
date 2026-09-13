"use client";

import { formatBaseUnits, shortHex } from "@masayume/core/units";
import { capResetsAtSec, dailyHeadroomBase } from "@masayume/core/vault";
import { requiredGasWei, sessionGasTopUpWei } from "@masayume/markets";
import { Hash, UtcTime } from "@/components/data";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/toast";
import { priceCapText } from "./caps";
import { SESSION } from "./copy";
import { useSessionKey } from "./SessionKeyProvider";
import { SessionModalShell } from "./SessionModal";
import { SessionDetail } from "./SessionDetail";
import styles from "./SessionDetails.module.css";
import type { SessionKeyActions, SessionBusy, SessionKeyView } from "./view";

interface SessionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArmNew: () => void;
  symbol: string;
}

const NATIVE_DECIMALS = 18;

function gasLine(view: SessionKeyView): string {
  const m = SESSION.manager;
  if (view.sponsor?.configured && view.sponsor.sponsor) {
    return view.sponsorRefusal ? m.gasSponsorDeclined(view.sponsorRefusal) : m.gasSponsor(shortHex(view.sponsor.sponsor, 8, 6));
  }
  if (view.keyGasWei === null || view.keyGasWei === 0n) return m.gasKeyEmpty;
  const perTap = requiredGasWei("vault-order");
  return m.gasKey(formatBaseUnits(view.keyGasWei, NATIVE_DECIMALS, { maxDp: 3, minDp: 0 }), Number(view.keyGasWei / perTap));
}

/** The manager body, separated so the fixture page can render every state without a provider. */
export function SessionManagerBody({ view, actions, busy, symbol, onArmNew }: { view: SessionKeyView; actions: SessionKeyActions; busy: SessionBusy; symbol: string; onArmNew: () => void }) {
  const m = SESSION.manager;
  const { grant, decimals } = view;
  const money = (base: bigint) => (
    <span className={styles.money}>
      <span>{formatBaseUnits(base, decimals)}</span>
      <span className={styles.unit}>{symbol}</span>
    </span>
  );
  const revoke = async () => {
    const outcome = await actions.revoke();
    if (outcome.status === "confirmed") notify.neutral(m.revoke, m.revokeNote);
  };
  const rekey = async () => {
    const { outcome, topUpError } = await actions.rekey();
    if (outcome.status === "confirmed") notify.neutral(m.rekey, topUpError ?? SESSION.sheet.armedBody);
  };

  if (view.status === "expired" || view.status === "disarmed" || !grant) {
    return (
      <div className="flex flex-col gap-3">
        {view.status === "expired" && (
          <>
            <p className="type-body-strong text-ink">{m.expiredTitle}</p>
            <p className="type-caption text-ink-secondary">{m.expiredBody}</p>
          </>
        )}
        <Button size="lg" className="w-full" onClick={onArmNew} disabled={view.status === "not-deployed" || view.status === "no-wallet"}>
          {m.armNew}
        </Button>
        {view.key && (
          <Button variant="ghost" size="sm" onClick={() => void actions.forget()}>
            {m.forget}
          </Button>
        )}
      </div>
    );
  }

  const spentToday = grant.spentDay === Math.floor(view.nowSec / 86_400) ? grant.spentTodayBase : 0n;
  const needsKey = view.status === "grant-without-key";
  const keyPays = !(view.sponsor?.configured ?? false);
  const lowGas = keyPays && (view.keyGasWei ?? 0n) < requiredGasWei("vault-order");

  return (
    <div className={styles.manager}>
      {needsKey && (
        <div className="flex flex-col gap-1 rounded-md border border-hairline bg-surface-2 p-3">
          <p className="type-body-strong text-ink">{m.needsKeyTitle}</p>
          <p className="type-caption text-ink-secondary">{m.needsKeyBody}</p>
        </div>
      )}
      <dl className={styles.scope}>
        <dt className={styles.label}>{m.scope}</dt>
        <dd className={styles.value}>{SESSION.sheet.receipt.scopeValue}</dd>
      </dl>
      <section>
        <h3 className={styles.heading}>{m.caps}</h3>
        <dl className={styles.limits}>
          <div className={styles.limit}>
            <dt className={styles.label}>{m.perTap}</dt>
            <dd className={styles.value}>{money(grant.caps.maxStakePerTradeBase)}</dd>
          </div>
          <div className={styles.limit}>
            <dt className={styles.label}>{m.perDay}</dt>
            <dd className={styles.value}>{money(grant.caps.maxDailySpendBase)}</dd>
          </div>
          <div className={styles.limit}>
            <dt className={styles.label}>{m.positions}</dt>
            <dd className={`${styles.value} numbers`}>{grant.caps.maxOpenPositions}</dd>
          </div>
          <div className={styles.limit}>
            <dt className={styles.label}>{m.price}</dt>
            <dd className={`${styles.value} numbers`}>{priceCapText(grant, decimals) ?? m.noPriceCap}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3 className={styles.heading}>{m.usage}</h3>
        <dl className={styles.details}>
          <SessionDetail label={m.spentToday}>{money(spentToday)}</SessionDetail>
          <SessionDetail label={m.headroom}>
            {money(dailyHeadroomBase(grant, view.nowSec))}
            <span className={styles.note}>{m.resets} <UtcTime ms={capResetsAtSec(view.nowSec) * 1000} withSeconds={false} /></span>
          </SessionDetail>
          <SessionDetail label={m.budget}>{money(grant.budgetBase)}</SessionDetail>
        </dl>
      </section>
      <section className={styles.section}>
        <h3 className={styles.heading}>{m.details}</h3>
        <dl className={styles.details}>
          <SessionDetail label={m.key}>
            <Hash value={grant.actor} lead={8} tail={6} />
          </SessionDetail>
          <SessionDetail label={m.expires}>
            <UtcTime ms={grant.expiresAtSec * 1000} withDate withSeconds={false} />
          </SessionDetail>
          <SessionDetail label={m.gas}>{gasLine(view)}</SessionDetail>
        </dl>
      </section>
      {lowGas && !needsKey && (
        <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void actions.topUp()}>
          {m.topUp(formatBaseUnits(sessionGasTopUpWei(), NATIVE_DECIMALS, { maxDp: 3, minDp: 0 }))}
        </Button>
      )}
      <div className={`${styles.section} flex flex-col gap-3`}>
        {needsKey && (
          <Button size="lg" className="w-full" disabled={busy !== null} onClick={() => void rekey()}>
            {busy === "rekeying" ? m.rekeying : m.rekey}
          </Button>
        )}
        <Button variant="secondary" size="lg" className="w-full" disabled={busy !== null} onClick={() => void revoke()}>
          {busy === "revoking" ? m.revoking : m.revoke}
        </Button>
        <p className="type-caption text-ink-muted">{m.revokeNote}</p>
        {view.key && (
          <Button variant="ghost" size="sm" onClick={() => void actions.forget()} title={m.forgetNote}>
            {m.forget}
          </Button>
        )}
      </div>
    </div>
  );
}

export function SessionManager({ open, onOpenChange, onArmNew, symbol }: SessionManagerProps) {
  const { view, actions, busy } = useSessionKey();
  return (
    <SessionModalShell open={open} onClose={() => onOpenChange(false)} title={SESSION.manager.title} description={SESSION.manager.description} labelId="session-manager-title">
      <SessionManagerBody view={view} actions={actions} busy={busy} symbol={symbol} onArmNew={onArmNew} />
    </SessionModalShell>
  );
}
