"use client";

import { useState } from "react";
import { notify } from "@/lib/toast";
import { STRATEGIES } from "./copy";
import { AmountRow, CapsEditor, RiskModePicker } from "./DeskInputs";
import { capsFor, joinFloorBase, money, parseAmount, type RiskMode } from "./format";
import type { StrategiesPayload, StrategyWire } from "./protocol";
import type { DeskModel } from "./useDesk";
import type { useDeskWrites } from "./useDeskWrites";
import "./desk.css";

const D = STRATEGIES.desk.join;
const DEFAULT_CAP_UNITS = 2n;

interface DeskJoinProps {
  featured: StrategyWire;
  payload: StrategiesPayload;
  desk: DeskModel;
  writes: ReturnType<typeof useDeskWrites>;
  onJoined: (tx: `0x${string}`) => void;
}

/** JOIN: collapsed to one CTA, then one decision (the amount) with defaulted, editable guardrails. */
export function DeskJoin({ featured, payload, desk, writes, onJoined }: DeskJoinProps) {
  const { decimals, symbol } = payload;
  const [open, setOpen] = useState(false);
  const [depositStr, setDepositStr] = useState("");
  const [capStr, setCapStr] = useState("");
  const [mode, setMode] = useState<RiskMode>("balanced");
  const [showCaps, setShowCaps] = useState(false);

  const one = 10n ** BigInt(decimals);
  const depositBase = parseAmount(depositStr, decimals);
  const budgetBase = desk.availableBase + depositBase;
  const capBase = parseAmount(capStr, decimals) || DEFAULT_CAP_UNITS * one;
  const typicalCost = BigInt(featured.record.typicalCostBase);
  const floor = joinFloorBase(typicalCost, capBase);
  const belowFloor = budgetBase < floor;
  const walletText = writes.snapshot && writes.snapshot.ok && writes.snapshot.value ? money(writes.snapshot.value.account.availableBase, decimals, symbol) : "—";
  const envelope = {
    maxStakePerTradeBase: BigInt(featured.envelope.maxStakePerTradeBase),
    maxDailySpendBase: BigInt(featured.envelope.maxDailySpendBase),
    maxOpenPositions: featured.envelope.maxOpenPositions,
    maxPriceRaw: BigInt(featured.envelope.maxPriceRaw),
  };
  const caps = capsFor(mode, capBase, budgetBase, decimals, envelope);

  const join = async () => {
    if (budgetBase <= 0n || belowFloor) return;
    const result = await writes.join({ strategyId: BigInt(featured.strategyId), runner: featured.runner as `0x${string}`, depositBase, budgetBase, caps, feeBase: BigInt(featured.feeBase) });
    if (result.ok) {
      if (result.txHash) onJoined(result.txHash);
      setDepositStr("");
      setCapStr("");
    } else {
      notify.warning(result.reason ?? "Couldn't join.");
    }
  };

  if (!open) {
    return (
      <div className="mt-5">
        <button type="button" onClick={() => setOpen(true)} className="desk-btn-primary desk-btn-primary--wide w-full sm:w-auto">
          {D.collapsed}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="desk-question text-ink">{D.question}</span>
          <button type="button" onClick={() => setOpen(false)} className="desk-note uppercase tracking-[0.12em] text-ink/35 hover:text-ink">
            {D.back}
          </button>
        </div>
        <AmountRow value={depositStr} onChange={setDepositStr} symbol={symbol} hint={<span>{STRATEGIES.desk.addHint(walletText)}</span>} chips={[1, 5]} onChip={(n) => setDepositStr(String(Math.max(0, (parseFloat(depositStr || "0") || 0) + n)))} />
        {desk.availableBase > 0n && <p className="desk-note mt-2 text-ink/40">{D.already(money(desk.availableBase, decimals))}</p>}
        {typicalCost > 0n && depositBase > 0n && depositBase < typicalCost && <p className="desk-note mt-2 text-ink/40">{D.belowCost(money(typicalCost, decimals))}</p>}
      </div>

      <div className="max-w-md">
        <RiskModePicker value={mode} onChange={setMode} />
        <div className="desk-copy mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink/55">
          <span className="font-semibold text-ink/80">{D.maxPerTrade(money(caps.maxStakePerTradeBase, decimals))}</span>
          <button type="button" onClick={() => setShowCaps((v) => !v)} className="desk-note uppercase tracking-[0.12em] text-ink/40 underline decoration-white/20 underline-offset-2 hover:text-vermilion">
            {showCaps ? D.done : D.change}
          </button>
          {showCaps && (
            <div className="mt-3 max-w-md basis-full">
              <CapsEditor capStr={capStr} setCapStr={setCapStr} suggested={String(DEFAULT_CAP_UNITS)} symbol={symbol} />
            </div>
          )}
        </div>
      </div>

      <div>
        <button type="button" onClick={join} disabled={writes.busy === "join" || belowFloor || !writes.canSign} className="desk-btn-primary desk-btn-primary--wide w-full sm:w-auto">
          {writes.busy === "join" ? D.busy : belowFloor ? D.floor(money(floor, decimals)) : depositBase > 0n ? D.put(money(depositBase, decimals)) : D.withBalance(money(desk.availableBase, decimals))}
        </button>
        <p className="desk-note mt-2 text-ink/40">{belowFloor ? D.floorNote(money(floor, decimals, symbol)) : D.twoSignatures}</p>
      </div>
    </div>
  );
}
