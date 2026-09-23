import { formatCadence } from "@agari/core/copy";
import type { RestingOrderView } from "@agari/core/projection";
import { formatBaseUnits } from "@agari/core/units";
import { useRef } from "react";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useCancelResting } from "@/features/markets/ticket/useCancelResting";
import { BALANCE, PREOPEN } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { Button } from "~/components/kit";
import { BetLine } from "./BetLine";
import { money } from "./format";
import { SignSheet } from "./SignSheet";
import { afterCommit, useSignFlow } from "./useSignFlow";

const onBook = (view: RestingOrderView) => view.status === "resting-for-open" || view.status === "resting";

function statusWord(view: RestingOrderView): string {
  if (view.status === "resting-for-open") return PREOPEN.rows.restingForOpen;
  if (view.status === "resting") return PREOPEN.rows.resting;
  if (view.status === "expired") return PREOPEN.rows.expired;
  return PREOPEN.rows.cancelled;
}

/**
 * web `RestingRow`: one scheduled call (D-088) — the call in the wallet's own terms ("UP at 55¢ · 10 contracts"), the
 * escrow it holds, when it fills by, and Cancel while it is on the Book. Cancel sends `user_cancel_orders` on the
 * call's own handle through web's `useCancelResting`; the escrow returns as the Window's venue credit.
 */
export function RestingRow({ view, symbol }: { view: RestingOrderView; symbol: string | undefined }) {
  const when = useWhen();
  const c = useCancelResting();
  const flow = useSignFlow();
  const latest = useRef(c);
  latest.current = c;
  const live = onBook(view);
  const contracts = formatBaseUnits(view.contractsRaw, view.decimals, { minDp: 0 });
  const call = PREOPEN.rows.call(SIDE_WORD[view.side], view.priceCents, contracts);
  const held = money(view.escrowBase, view.decimals, symbol);
  const canCancel = live && c.canSign && view.handle !== null && view.handle !== undefined;

  const confirm = () =>
    void flow.run(async () => {
      await c.cancel(view.marketId, [view.handle as NonNullable<RestingOrderView["handle"]>]);
      await afterCommit();
      const now = latest.current;
      return now.done ? { landed: true, tone: "ok", text: PREOPEN.receipt.cancelled } : { landed: false, tone: "warn", text: now.note ?? "The cancel did not land." };
    });

  return (
    <>
      <BetLine
        status={statusWord(view)}
        asset={view.asset}
        title={`${view.asset} ${SIDE_WORD[view.side]}`}
        marketId={view.marketId}
        meta={[formatCadence(view.intervalSec), call]}
        figures={[
          { label: PREOPEN.rows.held, value: held },
          { label: live ? PREOPEN.rows.fillsBy : "Status", value: live ? `${when(view.expireSec)} ET` : PREOPEN.rows.expiredWhy },
        ]}
        notes={[c.note]}
        action={canCancel ? <Button label={c.busy ? PREOPEN.rows.cancelling : PREOPEN.rows.cancel} variant="outline" size="sm" block={false} disabled={c.busy} onPress={flow.start} /> : null}
      />
      <SignSheet
        visible={flow.open}
        onClose={flow.close}
        title={`${PREOPEN.rows.cancel} · ${view.asset} ${call}`}
        lines={[
          { label: "Escrow released", value: held, tone: "accent" },
          { label: "Lands as", value: BALANCE.rows.credit, hint: BALANCE.creditFirst },
        ]}
        maxLoss={money(0n, view.decimals, symbol)}
        confirmLabel="Slide to cancel"
        onConfirm={confirm}
        phase={flow.phase}
        outcome={flow.outcome}
      />
    </>
  );
}
