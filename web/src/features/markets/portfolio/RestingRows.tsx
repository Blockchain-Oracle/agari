"use client";

import type { RestingOrderView } from "@agari/core/projection";
import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import { useRestingOrders } from "@agari/markets/react";
import Link from "next/link";
import { Money } from "@/components/data";
import { formatCadence, PREOPEN } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { ListItem } from "@/lib/use-pager";
import { useWalletSession } from "@/lib/wallet-session";
import { etWhen } from "../lanes/lane-view";
import { SIDE_WORD } from "../side-styles";
import { useCancelResting } from "../ticket/useCancelResting";

export interface RestingRowCancel {
  busy: boolean;
  note: string | null;
  onCancel: () => void;
}

export interface RestingRowViewProps {
  view: RestingOrderView;
  symbol: string | undefined;
  /** Null where nothing can sign (a fixture, or a call already off the Book). */
  cancel: RestingRowCancel | null;
}

const onBook = (view: RestingOrderView) => view.status === "resting-for-open" || view.status === "resting";

function statusWord(view: RestingOrderView): string {
  switch (view.status) {
    case "resting-for-open":
      return PREOPEN.rows.restingForOpen;
    case "resting":
      return PREOPEN.rows.resting;
    case "expired":
      return PREOPEN.rows.expired;
    default:
      return PREOPEN.rows.cancelled;
  }
}

/**
 * One scheduled call in Portfolio's Open tab (D-088), in `BetRow`'s anatomy: the state word where the live dot sits,
 * the Window, the call in the wallet's own terms ("UP at 55¢ · 10 contracts"), what is held, when it fills, and
 * Cancel while it is on the Book. Past its expiry the row says the stake is coming back rather than pretending to rest.
 */
export function RestingRowView({ view, symbol, cancel }: RestingRowViewProps) {
  const live = onBook(view);
  const contractsText = formatBaseUnits(view.contractsRaw, view.decimals, { minDp: 0 });
  return (
    <li className="bets-row" data-status={view.status}>
      <span className={cn("type-label-micro shrink-0", live ? "text-ink-secondary" : "text-ink")}>
        {live && (
          <span aria-hidden className="mr-1.5 text-ink-muted">
            ●
          </span>
        )}
        {statusWord(view)}
      </span>

      <Link href={marketDeepLink({ marketId: view.marketId })} data-cursor="hover" className="type-body-strong text-ink">
        {view.asset} {SIDE_WORD[view.side]}
      </Link>
      <span className="type-label-micro text-ink-muted">{formatCadence(view.intervalSec)}</span>
      <span className="type-caption text-ink-secondary">{PREOPEN.rows.call(SIDE_WORD[view.side], view.priceCents, contractsText)}</span>

      <span className="bets-break" aria-hidden />
      <span className="flex-1" />

      <span className="type-caption text-ink-secondary">
        {PREOPEN.rows.held} <Money value={view.escrowBase} decimals={view.decimals} symbol={symbol} />
      </span>
      <span className="type-caption text-ink-secondary">{live ? `${PREOPEN.rows.fillsBy} ${etWhen(view.expireSec)} ET` : PREOPEN.rows.expiredWhy}</span>
      {live && cancel && (
        <button type="button" className="type-caption text-accent underline" disabled={cancel.busy} onClick={cancel.onCancel} data-cursor="hover">
          {cancel.busy ? PREOPEN.rows.cancelling : PREOPEN.rows.cancel}
        </button>
      )}
      {cancel?.note && (
        <span className="type-caption basis-full text-left text-warning sm:text-right" role="status">
          {cancel.note}
        </span>
      )}
    </li>
  );
}

/** The live row: Cancel sends `user_cancel_orders` on the call's own handle. */
function RestingRow({ view, symbol }: { view: RestingOrderView; symbol: string | undefined }) {
  const c = useCancelResting();
  const cancel: RestingRowCancel | null =
    c.canSign && view.handle ? { busy: c.busy, note: c.note, onCancel: () => void c.cancel(view.marketId, [view.handle as NonNullable<RestingOrderView["handle"]>]) } : null;
  return <RestingRowView view={view} symbol={symbol} cancel={cancel} />;
}

/**
 * The wallet's scheduled calls as Open-tab items, ahead of the positions: what rests now or is on its way back. A
 * filled call is a position and appears there instead; a cancelled one has left the index's open set.
 */
export function useRestingItems(symbol: string | undefined): ListItem[] {
  const { address } = useWalletSession();
  const reading = useRestingOrders(address);
  if (!reading || !isOk(reading)) return [];
  return reading.value.filter((view) => view.status !== "filled" && view.status !== "cancelled").map((view) => ({ key: `resting:${view.id}`, node: <RestingRow view={view} symbol={symbol} /> }));
}
