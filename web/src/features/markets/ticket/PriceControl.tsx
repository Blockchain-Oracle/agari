"use client";

import { isPriceCents } from "@agari/core/orders";
import type { Side } from "@agari/core/types";
import { useEffect, useState } from "react";
import { PREOPEN } from "@/lib/copy";
import { SIDE_WORD } from "../side-styles";
import "./preopen.css";

/** Where a scheduled call starts: a shade over even, the price a bettor with a lean would name. */
export const DEFAULT_PRICE_CENTS = 55;
export const PRICE_CHIPS = [50, 55, 60, 70] as const;
const MIN_CENTS = 1;
const MAX_CENTS = 99;

interface PriceControlProps {
  priceCents: number;
  onChange: (cents: number) => void;
  side: Side | null;
  symbol: string;
}

/**
 * The call's price, in whole cents (D-088): a 1¢ stepper around the figure and four quick chips, in the amount block's
 * own grammar (`.tk-amount`, `Ticket624Drawer.tsx` L1045–1095) so the two sizing controls read as one column. The value
 * is always an integer 1..99; a keystroke that isn't one changes nothing until it is.
 */
export function PriceControl({ priceCents, onChange, side, symbol }: PriceControlProps) {
  const [text, setText] = useState(String(priceCents));
  useEffect(() => setText(String(priceCents)), [priceCents]);
  const step = (by: number) => onChange(Math.min(MAX_CENTS, Math.max(MIN_CENTS, priceCents + by)));
  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setText(digits);
    const cents = Number(digits);
    if (digits && isPriceCents(cents)) onChange(cents);
  };
  return (
    <div className="tk-amount tk-price">
      <div className="tk-amount-head">
        <span className="tk-amount-label">{PREOPEN.ticket.priceLabel}</span>
        <span className="tk-amount-balance">{PREOPEN.ticket.pays(symbol)}</span>
      </div>
      <div className="tk-amount-field">
        <button type="button" className="tk-add tk-price-step" aria-label={PREOPEN.ticket.step.down} disabled={priceCents <= MIN_CENTS} onClick={() => step(-1)} data-cursor="hover">
          −
        </button>
        <input
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={(event) => type(event.target.value)}
          onBlur={() => setText(String(priceCents))}
          className="tk-amount-input"
          aria-label={PREOPEN.ticket.priceAria(side ? SIDE_WORD[side] : "")}
        />
        <span className="tk-amount-unit">¢</span>
        <button type="button" className="tk-add tk-price-step" aria-label={PREOPEN.ticket.step.up} disabled={priceCents >= MAX_CENTS} onClick={() => step(1)} data-cursor="hover">
          +
        </button>
      </div>
      <div className="tk-amount-row">
        <div role="group" aria-label={PREOPEN.ticket.priceChips} className="tk-adds">
          {PRICE_CHIPS.map((cents) => (
            <button key={cents} type="button" className="tk-add" aria-pressed={cents === priceCents} onClick={() => onChange(cents)} data-cursor="hover">
              {cents}¢
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
