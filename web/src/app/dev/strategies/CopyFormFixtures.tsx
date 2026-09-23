"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/chrome";
import { checkCopyForm, type CopyFormInput } from "@/features/strategies/copy-form";
import { CopyFormFields } from "@/features/strategies/CopyFormFields";
import "@/features/strategies/strategies.css";
import "@/features/strategies/builder.css";

/** The copy drawer's form in the four states the S23 review asked for, with no wallet and no registry. */
const BASE: CopyFormInput = {
  budgetText: "100", perTradeText: "5", decimals: 6, symbol: "tUSDC", strategyMaxBase: 5_000_000n, walletBase: 142_500_000n, reusableBase: 12_000_000n,
  feeBase: 0n, feeError: null, busy: false, canSign: true, readable: true, otherPendingId: null, releasePending: false, resuming: false,
};
const CASES: Array<[string, Partial<CopyFormInput>]> = [
  ["Ready — the button can be pressed", {}],
  ["Most per trade above the strategy's 5.00", { perTradeText: "10" }],
  ["The wallet cannot cover the top-up", { walletBase: 30_000_000n, budgetText: "80" }],
  ["Waiting on the permission read", { readable: false }],
];

function Case({ title, over }: { title: string; over: Partial<CopyFormInput> }) {
  const [budget, setBudget] = useState(over.budgetText ?? BASE.budgetText);
  const [perTrade, setPerTrade] = useState(over.perTradeText ?? BASE.perTradeText);
  const input = { ...BASE, ...over, budgetText: budget, perTradeText: perTrade };
  const check = checkCopyForm(input);
  return (
    <div className="strat-drawer" style={{ position: "static", maxWidth: 440, height: "auto", transform: "none" }} data-fixture-copy={title}>
      <p className="strat-meta mb-4 text-vermilion">{title}</p>
      <CopyFormFields check={check} budget={budget} perTrade={perTrade} setBudget={setBudget} setPerTrade={setPerTrade} fixed={null} fieldsDisabled={false} decimals={6} symbol="tUSDC" walletBase={input.walletBase} vaultAvailableBase={input.reusableBase} feeBase={input.feeBase} confirmBusy={false} onConfirm={() => undefined} confirmLabel="Fund permission and copy">
        <p className="strat-drawer-body">Strategy maximum: 5.00 tUSDC per trade. Your limit must fit within your budget. This permission lasts 30 days.</p>
      </CopyFormFields>
    </div>
  );
}

export function CopyFormFixtures() {
  return (
    <section className="flex flex-col gap-4" id="copy-form">
      <SectionHeader index="09" title="Copy form — every field says why, the button names its one reason" />
      <div className="grid gap-6 md:grid-cols-2">
        {CASES.map(([title, over]) => <Case key={title} title={title} over={over} />)}
      </div>
    </section>
  );
}
