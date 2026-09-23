"use client";

import { BPS_PER_X, leverageBpsOf, type LeverageReserveState } from "@agari/core/leverage";
import type { EventMarket } from "@agari/core/types";
import { bpsToOddsCents, formatBaseUnits, parseDecimalToBaseUnits, priceRawToBps } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Money } from "@/components/data";
import { diagnosisCopy } from "@/lib/copy";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useLeverageQuote, useLeverageWrites } from "../leverage";
import { ConnectButton } from "../markets/wallet";
import { SHORT } from "./copy";
import { nameOfAsset } from "./ShortAssetCard";
import { isLiveWindow, opensAt } from "./useShortWindows";

/** The reserve quotes a size; the book can move between the quote and the send. The open accepts up to 5% fewer contracts, as the Ticket's boost does. */
const FILL_FLOOR_BPS = 9_500n;

interface ShortTicketProps {
  market: EventMarket | null;
  nowMs: number;
  reserve: LeverageReserveState;
  symbol: string;
  walletBase: bigint | null;
  connected: boolean;
}

/**
 * The short's own ticket: stake, multiple, and what the reserve would actually open.
 *
 * `owner_open` requires `leverage_bps > LEVERAGE_ONE_BPS` (`open.rs:77`), so the chips start at 2× — a 1×
 * position is a plain Down call on the Ticket, not a position the reserve holds. Everything priced here comes
 * from `sizeLeverageForStake`, which is the same walk the program runs, so the ticket never offers terms the
 * chain would refuse.
 */
export function ShortTicket({ market, nowMs, reserve, symbol, walletBase, connected }: ShortTicketProps) {
  const { ticket } = SHORT;
  const { params } = reserve;
  const maxMultiple = Math.floor(params.maxLeverageBps / BPS_PER_X);
  const multiples = useMemo(() => Array.from({ length: Math.max(0, maxMultiple - 1) }, (_, i) => i + 2), [maxMultiple]);
  const [multiple, setMultiple] = useState(2);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const first = multiples[0];
    if (first !== undefined && !multiples.includes(multiple)) setMultiple(first);
  }, [multiples, multiple]);

  if (!connected) {
    return (
      <div className="sh-ticket sh-ticket--connect">
        <p className="sh-connect-t">{ticket.connect}</p>
        <div className="sh-cta-row">
          <ConnectButton />
        </div>
      </div>
    );
  }
  // No Window means nothing to quote against, so the sizer — and the chain read inside it — never mounts.
  if (!market) {
    return (
      <div className="sh-ticket">
        <p className="sh-note">{ticket.pickWindow}</p>
      </div>
    );
  }
  // `owner_open` requires a trading Window: one that opens later says when, and offers the plain Down call instead.
  if (!isLiveWindow(market, nowMs)) {
    return (
      <div className="sh-ticket sh-ticket--opens">
        <span className="sh-opens-icon" aria-hidden>
          <CalendarClock />
        </span>
        <p className="sh-opens-t">{ticket.opensTitle(nameOfAsset(market.asset), opensAt(market.tradingStartSec))}</p>
        <p className="sh-opens-d">{ticket.opensBody}</p>
        <Link href={marketDeepLink({ marketId: market.marketId, dir: "down" })} className="sh-cta sh-cta--link" data-cursor="hover">
          {ticket.scheduleDown}
        </Link>
      </div>
    );
  }
  return (
    <Sizer
      market={market}
      reserve={reserve}
      symbol={symbol}
      walletBase={walletBase}
      multiples={multiples}
      multiple={multiple}
      onMultiple={setMultiple}
      amount={amount}
      onAmount={setAmount}
    />
  );
}

interface SizerProps {
  market: EventMarket;
  reserve: LeverageReserveState;
  symbol: string;
  walletBase: bigint | null;
  multiples: number[];
  multiple: number;
  onMultiple: (x: number) => void;
  amount: string;
  onAmount: (text: string) => void;
}

/** The quoting half: it only ever exists with a Window, so `useLeverageQuote` is handed the market it documents. */
function Sizer({ market, reserve, symbol, walletBase, multiples, multiple, onMultiple, amount, onAmount }: SizerProps) {
  const { ticket } = SHORT;
  const { decimals, params, paused } = reserve;
  const writes = useLeverageWrites();
  const stakeBase = parseDecimalToBaseUnits(amount || "0", decimals) ?? 0n;
  const leverageBps = leverageBpsOf(multiple);
  const quoteState = useLeverageQuote({
    market,
    side: "down",
    stakeBase,
    leverageBps,
    params,
    enabled: writes.canSign && !paused && stakeBase > 0n,
  });
  const { quote } = quoteState;
  const wallet = walletBase ?? 0n;

  const open = async () => {
    if (!quote) return;
    const outcome = await writes.open({
      marketId: market.marketId,
      side: "down",
      stakeBase,
      leverageBps,
      minQuantityRaw: (quote.quantityRaw * FILL_FLOOR_BPS) / 10_000n,
    });
    if (!outcome) return;
    if (outcome.status === "confirmed") {
      onAmount("");
      notify.neutral(ticket.opened(formatBaseUnits(outcome.quantityRaw, decimals, { minDp: 0 }), market.asset));
      return;
    }
    if (outcome.status === "requote") {
      notify.warning(diagnosisCopy("requote").headline, ticket.requote(formatBaseUnits(outcome.quantityRaw, decimals, { minDp: 0 })));
      quoteState.retry();
      return;
    }
    const copy = diagnosisCopy(outcome.diagnosis.kind);
    notify.warning(copy.headline, outcome.diagnosis.technical || copy.body);
  };

  const thin = quoteState.error?.kind === "thin-book" ? thinBook(quoteState.error.technical, stakeBase) : null;
  const note = paused
    ? ticket.paused
    : stakeBase <= 0n
      ? ticket.enterAmount
      : thin
        ? thin.maxBase === null
          ? ticket.thinExit
          : thin.maxBase <= 0n
            ? ticket.thinNone
            : ticket.thinSome(formatBaseUnits(thin.maxBase, decimals, { minDp: 2, maxDp: 2 }), symbol)
        : quoteState.error
          ? diagnosisCopy(quoteState.error.kind).headline
          : quote
          ? quote.stakeBase < stakeBase
            ? ticket.sized(formatBaseUnits(quote.stakeBase, decimals), symbol)
            : null
          : quoteState.loading
            ? ticket.pricing
            : null;

  return (
    <div className="sh-ticket">
      <div className="sh-field-head">
        <span className="sh-k">{ticket.amount}</span>
        <span className="sh-wallet">{walletBase === null ? ticket.walletPending : ticket.wallet(formatBaseUnits(wallet, decimals, { minDp: 2, maxDp: 2 }), symbol)}</span>
      </div>
      <div className="sh-field">
        <input
          value={amount}
          onChange={(e) => onAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0.00"
          inputMode="decimal"
          className="sh-input numbers"
          name="short-stake"
          id="short-stake"
          aria-label={ticket.amount}
        />
        <button type="button" onClick={() => onAmount(formatBaseUnits(wallet, decimals, { minDp: 2, maxDp: 2, group: false }))} disabled={walletBase === null} className="sh-max" data-cursor="hover">
          {ticket.max}
        </button>
        <span className="sh-unit">{symbol}</span>
      </div>

      <span className="sh-k sh-k--gap">{ticket.multiple}</span>
      <div className="sh-multiples" role="group" aria-label={ticket.multiple}>
        {multiples.map((x) => (
          <button key={x} type="button" aria-pressed={x === multiple} onClick={() => onMultiple(x)} className={cn("sh-multiple", x === multiple && "sh-multiple--on")} data-cursor="hover">
            {x}×
          </button>
        ))}
      </div>
      <p className="sh-hint">{ticket.multipleHint(percentOf(params.premiumBps))}</p>

      <Readout quote={quote} decimals={decimals} symbol={symbol} />
      {note && <p className={cn("sh-note", (quoteState.error || thin) && "sh-note--warn")}>{note}</p>}
      {thin && thin.maxBase !== null && thin.maxBase > 0n && (
        <button type="button" className="sh-usemax" onClick={() => onAmount(formatBaseUnits(thin.maxBase as bigint, decimals, { minDp: 2, maxDp: 2, group: false }))} data-cursor="hover">
          {ticket.useMax(formatBaseUnits(thin.maxBase, decimals, { minDp: 2, maxDp: 2 }), symbol)}
        </button>
      )}

      <button type="button" onClick={() => void open()} disabled={!quote || writes.busy === "open" || paused} className="sh-cta" data-cursor="hover">
        {writes.busy === "open" ? (
          ticket.busy
        ) : quote ? (
          <>
            {ticket.cta(market.asset, multiple)} <Money value={quote.stakeBase} decimals={decimals} symbol={symbol} />
          </>
        ) : (
          ticket.ctaPlain
        )}
      </button>
      {quote && (
        <p className="sh-knock">{ticket.knockNote(formatBaseUnits(quote.lineBase, decimals), symbol)}</p>
      )}
    </div>
  );
}

/** Contracts, the price they were priced at, and what comes back if the stock falls — the three the reserve quotes. */
function Readout({ quote, decimals, symbol }: { quote: { quantityRaw: bigint; priceRaw: bigint; winIfRightBase: bigint } | null; decimals: number; symbol: string }) {
  const { cells } = SHORT.ticket;
  return (
    <dl className="sh-readout">
      <div className="sh-cell">
        <dt>{cells.contracts}</dt>
        <dd className="numbers">{quote ? formatBaseUnits(quote.quantityRaw, decimals, { minDp: 0, maxDp: 2 }) : "—"}</dd>
      </div>
      <div className="sh-cell">
        <dt>{cells.entry}</dt>
        <dd className="numbers">{quote ? `${bpsToOddsCents(priceRawToBps(quote.priceRaw, decimals))}¢` : "—"}</dd>
      </div>
      <div className="sh-cell">
        <dt>{cells.back}</dt>
        <dd>{quote ? <Money value={quote.winIfRightBase} decimals={decimals} symbol={symbol} /> : <span className="numbers">—</span>}</dd>
      </div>
    </dl>
  );
}

/**
 * A thin book in plain terms: the quote's refusal names how much of the stake's contracts is on offer ("F of the Q this
 * stake buys"), so the stake that fits is the same share of it, less 5% for the book moving. `maxBase` is null when the
 * refusal is about the exit or the spread, where a smaller stake is not a sure fix.
 */
function thinBook(technical: string, stakeBase: bigint): { maxBase: bigint | null } {
  const m = /^(\d+) of the (\d+) this stake buys is on offer/.exec(technical);
  if (!m) return { maxBase: null };
  const filled = BigInt(m[1] as string);
  const wanted = BigInt(m[2] as string);
  if (filled <= 0n || wanted <= 0n) return { maxBase: 0n };
  return { maxBase: (stakeBase * filled * 95n) / (wanted * 100n) };
}

/** A bps parameter as the percentage the copy names: 800 → "8%", 1_250 → "12.5%". */
function percentOf(bps: number): string {
  return `${Math.round(bps / 10) / 10}%`;
}
