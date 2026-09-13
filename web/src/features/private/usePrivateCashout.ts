"use client";

import type { PrivateCashoutResult, PrivateTicket } from "@masayume/core/private";
import type { Address } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { invalidateAfterWrite } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { notify } from "@/lib/toast";
import { upsertPrivateTicket } from "./claims-store";
import { PRIVATE } from "./copy";

/** Presents the claim and nothing else; the reply says where the money went, and the stored row follows it. */
export function usePrivateCashout(refresh: () => void, decimals: number, symbol: string) {
  const queryClient = useQueryClient();
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const cashOut = useCallback(
    async (ticket: PrivateTicket): Promise<PrivateCashoutResult | null> => {
      setBusySlot(ticket.claim.slotId);
      try {
        const res = await fetch("/api/private/cashout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claim: ticket.claim, signature: ticket.signature }) });
        const json = (await res.json().catch(() => null)) as (PrivateCashoutResult & { error?: string }) | { error?: string } | null;
        if (!res.ok || !json || !("status" in json)) {
          notify.warning(PRIVATE.claims.cashOut, (json && "error" in json && json.error) || `private route answered ${res.status}`);
          return null;
        }
        if (json.status === "open") {
          notify.neutral(PRIVATE.toasts.stillOpen);
        } else if (json.status === "credited") {
          const payout = BigInt(json.payoutBase);
          upsertPrivateTicket({ ...ticket, status: "credited", payoutBase: json.payoutBase, creditedBase: json.creditedBase, creditedAtMs: Date.now(), ...(json.txs.credit ? { creditTx: json.txs.credit } : {}) });
          if (payout > 0n) notify.neutral(PRIVATE.toasts.cashedOut(formatBaseUnits(BigInt(json.creditedBase), decimals), symbol));
          else notify.neutral(PRIVATE.toasts.lost);
        } else {
          // Already home — from another browser, or an earlier tap. This browser never saw the settlement, so it
          // records what reached the balance and claims nothing about the outcome it did not witness.
          upsertPrivateTicket({ ...ticket, status: "credited", creditedBase: json.creditedBase, creditedAtMs: ticket.creditedAtMs ?? Date.now() });
          notify.neutral(PRIVATE.toasts.alreadyHome);
        }
        refresh();
        await invalidateAfterWrite(queryClient, { wallet: ticket.claim.owner as Address });
        return json;
      } finally {
        setBusySlot(null);
      }
    },
    [queryClient, refresh, decimals, symbol],
  );

  return { cashOut, busySlot };
}
