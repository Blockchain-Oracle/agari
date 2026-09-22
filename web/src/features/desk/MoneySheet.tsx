"use client";

import { nameOf } from "@agari/core/desk";
import type { PreIpoSymbol } from "@agari/core/market";
import type { Reading } from "@agari/core";
import { parseDecimalToBaseUnits } from "@agari/core/units";
import { DESK_MINTS, USDC_MAINNET, type OwnerDeskBalances } from "@agari/markets/desk";
import { useState } from "react";
import { notify } from "@/lib/toast";
import { ControlCard } from "./ControlCard";
import { MONEY } from "./copy-controls";
import { tokens, usd } from "./format";
import { MIN_DEPOSIT_E6, TRANSFER_FEE_BPS } from "./protocol";
import { useOwnerBalances } from "./useDesk";
import type { DeskActions } from "./useDeskWrites";
import type { DeskView } from "./view";

const CARD_TTL_SEC = 600;
/** Raw 9 dp × the ScaledUiAmount multiplier (E12) → UI tokens at 9 dp, for the receipt's figures. */
const uiRaw = (raw: bigint, multiplierE12: bigint | null): bigint => (multiplierE12 === null ? raw : (raw * multiplierE12) / 10n ** 12n);
const netOfFee = (raw: bigint): bigint => (raw * BigInt(10_000 - TRANSFER_FEE_BPS)) / 10_000n;

interface MoneySheetProps {
  view: DeskView;
  actions: DeskActions;
  kind: "deposit" | "withdraw";
  zone: string | null;
  nowSec: number;
  onClose: () => void;
  /** Fixtures hand the balances in; live use reads them through `/api/rpc/mainnet`. */
  balances?: Reading<OwnerDeskBalances> | null;
}

/**
 * Money in, money out (plan §5.5). Put money in has two ways side by side: USDC from this wallet, and PreStocks
 * tokens already held, with PreStocks' 1% transfer fee shown before confirming ("4.2 OPENAI leaves · 4.158 arrives").
 * Withdraw goes to the owner's own wallet only, some or all, as cash (the desk sells first) or as tokens. Money goes
 * straight to the desk's own account, never through Agari; the network is named on every card.
 */
export function MoneySheet({ view, actions, kind, zone, nowSec, onClose, balances: given }: MoneySheetProps) {
  const symbols = view.mandate?.targets.tokens.map((t) => t.symbol) ?? [];
  const read = useOwnerBalances(given === undefined ? actions.owner : null, symbols, given === undefined);
  const balances = given === undefined ? read : given;
  const [openedAtSec] = useState(nowSec);
  const [way, setWay] = useState<"usdc" | "tokens">("usdc");
  const [amount, setAmount] = useState("");
  const [symbol, setSymbol] = useState<PreIpoSymbol | null>(symbols[0] ?? null);
  const [everything, setEverything] = useState(true);
  const [asCash, setAsCash] = useState(false);
  const { state } = actions;
  const common = { expiresAtSec: openedAtSec + CARD_TTL_SEC, nowSec, zone, phase: state.phase, problem: state.problem, signature: state.signature, onClose, money: true };
  const owner = actions.owner ?? "";

  if (balances === null) return <p className="type-body text-ink-secondary">{MONEY.reading}</p>;
  if (!balances.ok) return <p className="type-body dk-warn">{MONEY.unreadable}</p>;
  const b = balances.value;
  const held = b.names.filter((n) => n.raw > 0n);
  const name = held.find((n) => n.symbol === symbol) ?? held[0] ?? null;
  const noSol = b.lamports === 0n;

  if (kind === "deposit") {
    const usdcE6 = parseDecimalToBaseUnits(amount, 6);
    const tooSmall = usdcE6 !== null && usdcE6 < MIN_DEPOSIT_E6;
    const usdcOk = usdcE6 !== null && usdcE6 > 0n && !tooSmall && usdcE6 <= b.usdc.raw && !noSol;
    const tokenRaw = name ? (everything ? name.raw : (parseDecimalToBaseUnits(amount, 9) ?? 0n)) : 0n;
    const tokenOk = name !== null && tokenRaw > 0n && tokenRaw <= name.raw && !noSol;
    const confirm = async () => {
      if (way === "usdc" && usdcOk) {
        const landed = await actions.tx("deposit", (s) => s.deposit({ mint: USDC_MAINNET, ownerToken: b.usdc.ownerToken, amount: usdcE6 }));
        if (landed.ok) notify.neutral(MONEY.deposited(usd(usdcE6), "USDC"));
      } else if (way === "tokens" && tokenOk && name) {
        const landed = await actions.tx("deposit", (s) => s.deposit({ mint: DESK_MINTS[name.symbol], ownerToken: name.ownerToken, amount: tokenRaw }));
        if (landed.ok) notify.neutral(MONEY.deposited(tokens(uiRaw(netOfFee(tokenRaw), name.multiplierE12)), name.symbol));
      }
    };
    return (
      <ControlCard {...common} title={MONEY.sheetTitle} body={MONEY.intro} now={[]} after={[]} who="wallet" disabled={way === "usdc" ? !usdcOk : !tokenOk} confirmLabel={MONEY.send} onConfirm={() => void confirm()}>
        <div className="dk-choices" role="radiogroup" aria-label={MONEY.sheetTitle}>
          <button type="button" role="radio" aria-checked={way === "usdc"} className="dk-choice" onClick={() => setWay("usdc")}>
            <span className="dk-choice-title">{MONEY.usdc.title}</span>
            <span className="dk-choice-body">{b.usdc.raw > 0n ? MONEY.usdc.have(usd(b.usdc.raw)) : MONEY.usdc.none}</span>
          </button>
          <button type="button" role="radio" aria-checked={way === "tokens"} className="dk-choice" onClick={() => setWay("tokens")}>
            <span className="dk-choice-title">{MONEY.tokens.title}</span>
            <span className="dk-choice-body">{held.length === 0 ? MONEY.tokens.none : held.map((n) => MONEY.tokens.row(tokens(uiRaw(n.raw, n.multiplierE12)), nameOf(n.symbol))).join(" · ")}</span>
          </button>
        </div>
        {way === "usdc" ? (
          <>
            <label className="dk-field"><span>{MONEY.usdc.amount}</span><input className="dk-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="300" /></label>
            {tooSmall && <p className="type-caption dk-warn">{MONEY.tooSmall(usd(MIN_DEPOSIT_E6, 0))}</p>}
            {usdcE6 !== null && usdcE6 > 0n && (
              <dl className="dk-receipt">
                <dt>{MONEY.receipt.send}</dt><dd>{usd(usdcE6)} USDC</dd>
                <dt>{MONEY.receipt.receive}</dt><dd>{usd(usdcE6)} USDC</dd>
                <dt>{MONEY.receipt.networkFee}</dt><dd>{MONEY.receipt.networkFeeValue}</dd>
                <dt>{MONEY.receipt.takes}</dt><dd>{MONEY.receipt.seconds}</dd>
              </dl>
            )}
          </>
        ) : name ? (
          <>
            <div className="dk-card-actions">
              {held.map((n) => (
                <button key={n.symbol} type="button" className="dk-control" aria-pressed={n.symbol === name.symbol} onClick={() => setSymbol(n.symbol)}>{nameOf(n.symbol)}</button>
              ))}
            </div>
            <div className="dk-card-actions">
              <button type="button" className="dk-control" aria-pressed={everything} onClick={() => setEverything(true)}>{MONEY.tokens.all}</button>
              <button type="button" className="dk-control" aria-pressed={!everything} onClick={() => setEverything(false)}>{MONEY.withdraw.some}</button>
              {!everything && <input className="dk-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={MONEY.tokens.title} />}
            </div>
            {tokenRaw > 0n && (
              <dl className="dk-receipt">
                <dt>{MONEY.receipt.send}</dt><dd>{MONEY.receipt.leaves(tokens(uiRaw(tokenRaw, name.multiplierE12)), name.symbol)}</dd>
                <dt>{MONEY.receipt.fee}</dt><dd>{tokens(uiRaw(tokenRaw - netOfFee(tokenRaw), name.multiplierE12))} {name.symbol}</dd>
                <dt>{MONEY.receipt.receive}</dt><dd>{MONEY.receipt.arrives(tokens(uiRaw(netOfFee(tokenRaw), name.multiplierE12)), name.symbol)}</dd>
                <dt>{MONEY.receipt.networkFee}</dt><dd>{MONEY.receipt.networkFeeValue}</dd>
              </dl>
            )}
          </>
        ) : (
          <p className="type-caption text-ink-secondary">{MONEY.tokens.none}</p>
        )}
        {noSol && <p className="type-caption dk-warn">{MONEY.noSol.line}</p>}
      </ControlCard>
    );
  }

  const cashE6 = view.wire.chain ? BigInt(view.wire.chain.usdcRaw) : 0n;
  const heldInDesk = (view.wire.chain?.tokens ?? []).filter((t) => t.symbol && BigInt(t.raw) > 0n);
  const someE6 = parseDecimalToBaseUnits(amount, 6);
  const usdcOk = everything ? cashE6 > 0n : someE6 !== null && someE6 > 0n && someE6 <= cashE6;
  const confirmWithdraw = async () => {
    if (asCash) {
      const requested = await actions.requestAction("sell_all");
      if (requested.ok) notify.neutral(MONEY.withdraw.cashNote);
      return;
    }
    if (usdcOk) {
      const landed = await actions.tx("withdraw", (s) => s.withdraw({ mint: USDC_MAINNET, ...(everything ? {} : { amount: someE6 as bigint }) }));
      if (landed.ok) notify.neutral(MONEY.withdrawn("USDC"));
    }
    if (everything) {
      for (const t of heldInDesk) {
        const landed = await actions.tx("withdraw", (s) => s.withdraw({ mint: DESK_MINTS[t.symbol as PreIpoSymbol] }));
        if (!landed.ok) break;
        notify.neutral(MONEY.withdrawn(t.symbol as string));
      }
    }
  };
  return (
    <ControlCard {...common} title={MONEY.withdraw.title} body={MONEY.withdraw.body} now={[MONEY.withdraw.usdcInDesk(usd(cashE6))]} after={[asCash ? MONEY.withdraw.asCash : everything ? MONEY.withdraw.perMint(1 + heldInDesk.length) : `${usd(someE6 ?? 0n)} USDC`]} who={asCash ? "request" : "wallet"} disabled={!asCash && !usdcOk && !(everything && heldInDesk.length > 0)} confirmLabel={MONEY.withdraw.button} onConfirm={() => void confirmWithdraw()}>
      <dl className="dk-receipt"><dt>{MONEY.withdraw.to}</dt><dd className="dk-mono dk-break">{owner}</dd></dl>
      <div className="dk-card-actions">
        <button type="button" className="dk-control" aria-pressed={!everything} onClick={() => setEverything(false)}>{MONEY.withdraw.some}</button>
        <button type="button" className="dk-control" aria-pressed={everything} onClick={() => setEverything(true)}>{MONEY.withdraw.all}</button>
        {!everything && <input className="dk-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={MONEY.withdraw.amount} placeholder="100" />}
      </div>
      {heldInDesk.length > 0 && (
        <div className="dk-choices" role="radiogroup" aria-label={MONEY.withdraw.title}>
          <button type="button" role="radio" aria-checked={!asCash} className="dk-choice" onClick={() => setAsCash(false)}><span className="dk-choice-title">{MONEY.withdraw.asTokens}</span></button>
          <button type="button" role="radio" aria-checked={asCash} className="dk-choice" onClick={() => setAsCash(true)}><span className="dk-choice-title">{MONEY.withdraw.asCash}</span><span className="dk-choice-body">{MONEY.withdraw.cashNote}</span></button>
        </div>
      )}
    </ControlCard>
  );
}
