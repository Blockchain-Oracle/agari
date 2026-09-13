"use client";

import { ConnectButton } from "@/features/markets/wallet";
import { TUTORIAL_UI } from "./steps";

/**
 * The closing screen — ported from Tutorial.tsx L117–137.
 *
 * The reference ends on a Simple/Pro choice that writes `yosuku_trade_mode` for a `TradePanel`
 * with two layouts — a panel `/markets` never mounts. Masayume's ticket has one layout, so the
 * choice would change nothing; it is left out rather than shipped as a control that does nothing
 * (ledger: Adapted). Like the reference, the last screen ends on Connect and stays open until the
 * wallet lands or the user skips.
 */
export function TutorialChoice({ description }: { description: string }) {
  return (
    <>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-4">
        <div className="tutorial-eyebrow mb-1 font-mono uppercase text-gray-600">{TUTORIAL_UI.lastStep}</div>
        <p className="mb-0.5 text-sm font-semibold text-white">{TUTORIAL_UI.connectTitle}</p>
        <p className="mb-3 text-xs leading-snug text-gray-500">{TUTORIAL_UI.connectNote}</p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>

      <p className="tutorial-fineprint mt-3 text-gray-600">{description}</p>
    </>
  );
}
