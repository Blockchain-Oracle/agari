"use client";

import type { Address } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { Hash, UtcTime } from "@/components/data";
import { SESSION } from "./copy";
import { SOL_DECIMALS } from "./fees";
import { SessionDetail } from "./SessionDetail";
import styles from "./SessionDetails.module.css";

interface CapabilityReceiptProps {
  keyAddress: Address | null;
  expiresAtSec: number;
  sponsorConfigured: boolean;
  /** SOL the enable flow will move to the key when the key pays its own fees, in lamports. */
  topUpLamports: bigint;
}

/** The capability receipt (UX-DR7): what the signature grants, what it can never do, who pays, and how many taps it takes. */
/** SPL deposits need no token approval, so arming is always one signature for the deposit and grant (D-012). */
export function CapabilityReceipt({ keyAddress, expiresAtSec, sponsorConfigured, topUpLamports }: CapabilityReceiptProps) {
  const r = SESSION.sheet.receipt;
  const base = r.sigsOne;
  const gasText = sponsorConfigured ? r.gasSponsor : r.gasKey(formatBaseUnits(topUpLamports, SOL_DECIMALS, { maxDp: 3, minDp: 0 }));
  return (
    <div className={styles.receipt}>
      <span className="tk-control-label">{SESSION.sheet.receiptTitle}</span>
      <dl className={styles.details}>
        <SessionDetail label={r.scope}>{r.scopeValue}</SessionDetail>
        <SessionDetail label={r.cannot}>{r.cannotValue}</SessionDetail>
        <SessionDetail label={r.key}>{keyAddress ? <Hash value={keyAddress} lead={8} tail={6} /> : "—"}</SessionDetail>
        <SessionDetail label={r.expiresAt}>
          <UtcTime ms={expiresAtSec * 1000} withDate withSeconds={false} />
        </SessionDetail>
        <SessionDetail label={r.gas}>{gasText}</SessionDetail>
        <SessionDetail label={r.signatures}>{sponsorConfigured ? base : r.sigsTopUp(base)}</SessionDetail>
      </dl>
    </div>
  );
}
