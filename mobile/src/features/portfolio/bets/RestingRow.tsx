import { formatCadence } from "@agari/core/copy";
import type { RestingOrderView } from "@agari/core/projection";
import { formatBaseUnits } from "@agari/core/units";
import { SIDE_WORD } from "@/features/markets/side-styles";
import { useCancelResting } from "@/features/markets/ticket/useCancelResting";
import { PREOPEN } from "@/lib/copy";
import { useWhen } from "@/lib/when";
import { BetsRow, Break, Call, Caption, Micro, MoneyText, RowNote, Status, TextAction } from "./RowParts";

const onBook = (view: RestingOrderView) => view.status === "resting-for-open" || view.status === "resting";

function statusWord(view: RestingOrderView): string {
  if (view.status === "resting-for-open") return PREOPEN.rows.restingForOpen;
  if (view.status === "resting") return PREOPEN.rows.resting;
  if (view.status === "expired") return PREOPEN.rows.expired;
  return PREOPEN.rows.cancelled;
}

/**
 * web `RestingRowView` + `RestingRow` (D-088): the state word, the Window, the call in the wallet's own terms, what is
 * held, when it fills by, and Cancel (`user_cancel_orders` on its own handle) while it is on the Book.
 */
export function RestingRow({ view, symbol, first }: { view: RestingOrderView; symbol: string | undefined; first: boolean }) {
  const when = useWhen();
  const c = useCancelResting();
  const live = onBook(view);
  const contracts = formatBaseUnits(view.contractsRaw, view.decimals, { minDp: 0 });
  const canCancel = live && c.canSign && view.handle !== null && view.handle !== undefined;
  return (
    <BetsRow first={first}>
      <Status word={statusWord(view)} dot={live ? "muted" : null} />
      <Call marketId={view.marketId} asset={null} text={`${view.asset} ${SIDE_WORD[view.side]}`} />
      <Micro>{formatCadence(view.intervalSec)}</Micro>
      <Caption>{PREOPEN.rows.call(SIDE_WORD[view.side], view.priceCents, contracts)}</Caption>
      <Break />
      <Caption>
        {PREOPEN.rows.held} <MoneyText value={view.escrowBase} decimals={view.decimals} symbol={symbol} />
      </Caption>
      <Caption>{live ? `${PREOPEN.rows.fillsBy} ${when(view.expireSec)} ET` : PREOPEN.rows.expiredWhy}</Caption>
      {canCancel ? (
        <TextAction
          label={c.busy ? PREOPEN.rows.cancelling : PREOPEN.rows.cancel}
          disabled={c.busy}
          onPress={() => void c.cancel(view.marketId, [view.handle as NonNullable<RestingOrderView["handle"]>])}
        />
      ) : null}
      <RowNote text={c.note} />
    </BetsRow>
  );
}
