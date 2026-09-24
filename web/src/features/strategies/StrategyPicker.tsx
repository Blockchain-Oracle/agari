"use client";

import type { StrategySubscription } from "@agari/core/strategies";
import { ChevronDown } from "lucide-react";
import { useCallback, useRef, useState, type RefObject } from "react";
import { useFloatingMenus } from "@/components/shell/header/useFloatingMenus";
import { cn } from "@/lib/utils";
import { AgentPortrait } from "./AgentPortrait";
import { STRATEGIES } from "./copy";
import { strategyIdentity } from "./identity";
import type { StrategyWire } from "./protocol";
import "./builder.css";

const P = STRATEGIES.picker;

interface StrategyPickerProps {
  strategies: readonly StrategyWire[];
  selected: string | null;
  onSelect: (strategyId: string) => void;
  subscriptionOf: (strategyId: string) => StrategySubscription | null;
  wallet: string | null;
  pendingId: string | null;
}

/**
 * "Manage a strategy": the wallet's own strategies in the reference's picker idiom (the parlay leg's
 * Window picker — a bordered trigger with a chevron and a dropping list), each row saying why it is yours.
 */
export function StrategyPicker({ strategies, selected, onSelect, subscriptionOf, wallet, pendingId }: StrategyPickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const refs = useRef<ReadonlyArray<RefObject<HTMLElement | null>>>([root]);
  const close = useCallback(() => setOpen(false), []);
  useFloatingMenus(refs.current, close);
  const current = strategies.find((s) => s.strategyId === selected) ?? null;

  const roleOf = (card: StrategyWire) => {
    const sub = subscriptionOf(card.strategyId);
    const roles: string[] = [];
    if (card.creator === wallet) roles.push(P.published);
    if (pendingId === card.strategyId) roles.push(P.pending);
    else if (sub?.active) roles.push(sub.fade ? P.fading : P.copying);
    else if (sub) roles.push(P.paused);
    return roles.join(" · ");
  };

  return (
    <div className="strat-picker mt-6" ref={root}>
      <p className="desk-field-label mb-2" id="strat-picker-label">{P.label}</p>
      <button type="button" className="strat-picker-btn" aria-haspopup="listbox" aria-expanded={open} aria-labelledby="strat-picker-label" onClick={() => setOpen((o) => !o)}>
        {current ? <PickerRow card={current} role={roleOf(current)} /> : <span className="strat-picker-empty">{P.choose}</span>}
        <ChevronDown className={cn("strat-picker-chevron", open && "strat-picker-chevron--open")} aria-hidden="true" />
      </button>
      {open && (
        <div className="strat-picker-menu" role="listbox" aria-labelledby="strat-picker-label">
          {strategies.map((card) => (
            <button
              key={card.strategyId}
              type="button"
              role="option"
              aria-selected={card.strategyId === selected}
              className={cn("strat-picker-item", card.strategyId === selected && "strat-picker-item--on")}
              onClick={() => { onSelect(card.strategyId); setOpen(false); }}
            >
              <PickerRow card={card} role={roleOf(card)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PickerRow({ card, role }: { card: StrategyWire; role: string }) {
  const { name, seed } = strategyIdentity(card);
  return (
    <span className="strat-picker-row">
      <AgentPortrait seed={seed} name={name} size="small" />
      <span className="min-w-0">
        <span className="strat-picker-name">{name}</span>
        <span className="strat-picker-meta">#{card.strategyId}{role && ` · ${role}`}</span>
      </span>
    </span>
  );
}
